import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ChequeLeafStatus, NotificationType } from '@prisma/client';
import * as jalaali from 'jalaali-js';
import { PrismaService } from '../prisma/prisma.service';
import { SmsOutboundService } from './sms-outbound.service';
import { SmsTemplateService } from './sms-template.service';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';
import { SMS_EVENT_KEYS } from './sms-event-keys';

/** Hard-required reminder recipients for cheque due dates. */
export const CHEQUE_DUE_REMINDER_PHONES = ['09370504588', '09121013686'] as const;

export type ChequeDueOffsetDays = 0 | 1 | 2;
export type ChequeReminderStage = 't_minus_2' | 't_minus_1' | 't_zero';

export type ChequeDueReminderPlanItem = {
  leafId: number;
  leafNumber: number;
  dueDate: string;
  jalaliDueDate: string;
  offsetDays: ChequeDueOffsetDays;
  stage: ChequeReminderStage;
  phone: string;
  dedupeKey: string;
  relatedEntity: string;
  message: string;
};

type BankAccountSnippet = {
  name: string;
  provider?: string | null;
  accountNo?: string | null;
  cardNo?: string | null;
  iban?: string | null;
};

type ChequebookSnippet = {
  serialNumber?: string | null;
  startNumber?: number | null;
  endNumber?: number | null;
  bankAccount?: BankAccountSnippet | null;
};

const STAGE_BY_OFFSET: Record<ChequeDueOffsetDays, ChequeReminderStage> = {
  2: 't_minus_2',
  1: 't_minus_1',
  0: 't_zero',
};

const STAGE_LABEL_FA: Record<ChequeReminderStage, string> = {
  t_minus_2: '۲ روز آینده',
  t_minus_1: 'فردا',
  t_zero: 'امروز',
};

/**
 * Daily cheque due-date reminders (T-2 through T-0) via SmsOutboundService.
 * Pure planner is exportable for dry-run tests without sending.
 */
@Injectable()
export class ChequeDueSmsReminderService {
  private readonly logger = new Logger(ChequeDueSmsReminderService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly smsOutbound: SmsOutboundService,
    private readonly smsTemplates: SmsTemplateService,
  ) {}

  /**
   * Independent kill-switch for cheque due SMS only.
   * Enabled solely when the env value is exactly "true".
   */
  isChequeDueSmsEnabled(): boolean {
    return this.config.get<string>('CHEQUE_DUE_SMS_ENABLED') === 'true';
  }

  /** Asia/Tehran calendar day bounds in UTC for a given local date. */
  static dayBoundsTehran(ymd: string): { start: Date; end: Date } {
    const start = new Date(`${ymd}T00:00:00+03:30`);
    const end = new Date(`${ymd}T23:59:59.999+03:30`);
    return { start, end };
  }

  static addDaysYmd(ymd: string, days: number): string {
    const d = new Date(`${ymd}T12:00:00+03:30`);
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  static todayYmdTehran(now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  static gregorianYmdToJalali(ymd: string): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const j = jalaali.toJalaali(y, m, d);
    return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
  }

  static stageForOffset(offsetDays: ChequeDueOffsetDays): ChequeReminderStage {
    return STAGE_BY_OFFSET[offsetDays];
  }

  static relatedEntityKey(
    leafId: number,
    stage: ChequeReminderStage,
    jalaliDueDate: string,
  ): string {
    return `cheque:reminder:${leafId}:${stage}:${jalaliDueDate}`;
  }

  static dedupeKey(
    leafId: number,
    stage: ChequeReminderStage,
    jalaliDueDate: string,
    phone: string,
  ): string {
    return `${ChequeDueSmsReminderService.relatedEntityKey(leafId, stage, jalaliDueDate)}:${phone.slice(-4)}`;
  }

  static formatBankDetails(account?: BankAccountSnippet | null): {
    bankName: string;
    branch: string;
    accountNumber: string;
  } {
    const rawName = account?.name?.trim() || '';
    const provider = account?.provider?.trim() || '';
    const branchMatch = rawName.match(/^(.*?)\s*شعبه\s+(.+)$/);
    const bankName =
      provider || (branchMatch ? branchMatch[1].trim() : rawName) || '—';
    const branch = (branchMatch ? branchMatch[2].trim() : '') || '—';
    const full =
      account?.accountNo?.trim() ||
      account?.iban?.trim() ||
      account?.cardNo?.trim() ||
      '';
    const compact = full.replace(/\s+/g, '');
    const accountNumber = compact
      ? compact.length > 4
        ? `…${compact.slice(-4)}`
        : compact
      : '—';
    return { bankName, branch, accountNumber };
  }

  static formatChequeBookSerial(book?: ChequebookSnippet | null): string {
    const serial = book?.serialNumber?.trim();
    if (serial) return serial;
    if (book?.startNumber != null && book?.endNumber != null) {
      return `${book.startNumber}–${book.endNumber}`;
    }
    return '—';
  }

  /** Cheque amounts are stored in IRR (ریال). */
  static formatAmountRial(amount: bigint | number | null | undefined): string {
    if (amount == null) return '—';
    const n = typeof amount === 'bigint' ? Number(amount) : amount;
    if (!Number.isFinite(n)) return '—';
    return `${n.toLocaleString('fa-IR')} ریال`;
  }

  async buildPlan(options?: {
    now?: Date;
    dryRun?: boolean;
  }): Promise<ChequeDueReminderPlanItem[]> {
    const today = ChequeDueSmsReminderService.todayYmdTehran(options?.now);
    const offsets: ChequeDueOffsetDays[] = [2, 1, 0];
    const plan: ChequeDueReminderPlanItem[] = [];

    for (const offsetDays of offsets) {
      const dueYmd = ChequeDueSmsReminderService.addDaysYmd(today, offsetDays);
      const jalaliDueDate = ChequeDueSmsReminderService.gregorianYmdToJalali(dueYmd);
      const { start, end } = ChequeDueSmsReminderService.dayBoundsTehran(dueYmd);
      const stage = ChequeDueSmsReminderService.stageForOffset(offsetDays);

      const leaves = await this.prisma.chequeLeaf.findMany({
        where: {
          deletedAt: null,
          status: ChequeLeafStatus.ISSUED,
          dueDate: { gte: start, lte: end },
          chequebook: { deletedAt: null },
        },
        select: {
          id: true,
          leafNumber: true,
          amount: true,
          payee: true,
          dueDate: true,
          category: true,
          chequebook: {
            select: {
              serialNumber: true,
              startNumber: true,
              endNumber: true,
              bankAccount: {
                select: {
                  name: true,
                  provider: true,
                  accountNo: true,
                  cardNo: true,
                  iban: true,
                },
              },
            },
          },
        },
      });

      for (const leaf of leaves) {
        const { bankName, branch, accountNumber } =
          ChequeDueSmsReminderService.formatBankDetails(leaf.chequebook?.bankAccount);
        const chequeBookSerial = ChequeDueSmsReminderService.formatChequeBookSerial(
          leaf.chequebook,
        );
        const amountLabel = ChequeDueSmsReminderService.formatAmountRial(leaf.amount);
        const stageLabel = STAGE_LABEL_FA[stage];
        const vars = {
          stageLabel,
          offsetLabel: stageLabel,
          leafNumber: String(leaf.leafNumber),
          payee: leaf.payee || '—',
          amount: amountLabel,
          dueDate: jalaliDueDate,
          jalaliDueDate,
          bankName,
          branch,
          accountNumber,
          chequeBookSerial,
        };
        const rendered = await this.smsTemplates.renderByKey(
          SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
          vars,
        );
        const message =
          rendered?.trim() ||
          [
            `دوکارد — یادآوری موعد چک (${stageLabel})`,
            `بانک: ${bankName}`,
            `شعبه: ${branch}`,
            `دسته چک: ${chequeBookSerial}`,
            `شماره برگ: ${leaf.leafNumber}`,
            `مبلغ: ${amountLabel}`,
            `سررسید: ${jalaliDueDate}`,
          ].join('\n');

        const relatedEntity = ChequeDueSmsReminderService.relatedEntityKey(
          leaf.id,
          stage,
          jalaliDueDate,
        );

        for (const phone of CHEQUE_DUE_REMINDER_PHONES) {
          plan.push({
            leafId: leaf.id,
            leafNumber: leaf.leafNumber,
            dueDate: dueYmd,
            jalaliDueDate,
            offsetDays,
            stage,
            phone,
            relatedEntity,
            dedupeKey: ChequeDueSmsReminderService.dedupeKey(
              leaf.id,
              stage,
              jalaliDueDate,
              phone,
            ),
            message,
          });
        }
      }
    }

    return plan;
  }

  async runReminders(options?: { now?: Date; dryRun?: boolean }): Promise<{
    planned: number;
    sent: number;
    skipped: number;
    dryRun: boolean;
    items: Array<
      Pick<
        ChequeDueReminderPlanItem,
        'dedupeKey' | 'phone' | 'leafId' | 'offsetDays' | 'stage'
      >
    >;
  }> {
    if (!this.isChequeDueSmsEnabled()) {
      this.logger.log(
        'Cheque due SMS skipped (CHEQUE_DUE_SMS_ENABLED is not true)',
      );
      return { planned: 0, sent: 0, skipped: 0, dryRun: true, items: [] };
    }

    const dryRun = options?.dryRun === true;
    const plan = await this.buildPlan({ now: options?.now, dryRun });
    let sent = 0;
    let skipped = 0;
    const items: Array<
      Pick<
        ChequeDueReminderPlanItem,
        'dedupeKey' | 'phone' | 'leafId' | 'offsetDays' | 'stage'
      >
    > = [];
    const notifiedEntities = new Set<string>();

    for (const item of plan) {
      items.push({
        dedupeKey: item.dedupeKey,
        phone: item.phone.replace(/\d(?=\d{4})/g, '*'),
        leafId: item.leafId,
        offsetDays: item.offsetDays,
        stage: item.stage,
      });
      if (dryRun) {
        skipped += 1;
        continue;
      }
      const result = await this.smsOutbound.sendIfAllowed({
        eventKey: SMS_EVENT_KEYS.CHEQUE_DUE_REMINDER,
        phone: item.phone,
        message: item.message,
        dedupeKey: item.dedupeKey,
        templateKey: SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
        skipAlwaysCc: true,
      });
      if (result.success && !result.skipped) {
        sent += 1;
        if (!notifiedEntities.has(item.relatedEntity)) {
          await this.recordInAppNotice(item);
          notifiedEntities.add(item.relatedEntity);
        }
      } else {
        skipped += 1;
      }
    }

    this.logger.log(
      `Cheque due reminders dryRun=${dryRun} planned=${plan.length} sent=${sent} skipped=${skipped}`,
    );

    return { planned: plan.length, sent, skipped, dryRun, items };
  }

  private async recordInAppNotice(item: ChequeDueReminderPlanItem): Promise<void> {
    try {
      const existing = await this.prisma.notification.findFirst({
        where: { relatedEntity: item.relatedEntity },
        select: { id: true },
      });
      if (existing) return;
      await this.prisma.notification.create({
        data: {
          title: `یادآوری موعد چک (${STAGE_LABEL_FA[item.stage]})`,
          message: item.message.slice(0, 500),
          type: NotificationType.GENERAL,
          roleTarget: 'ADMIN',
          relatedEntity: item.relatedEntity,
        },
      });
    } catch (err: any) {
      this.logger.warn(
        `Cheque in-app notice skipped leaf=${item.leafId}: ${err?.message || 'unknown'}`,
      );
    }
  }

  @Cron('0 9 * * *', { timeZone: 'Asia/Tehran' })
  async scheduledReminders() {
    try {
      await this.runReminders();
    } catch (err: any) {
      this.logger.error(
        `Cheque due reminder cron failed: ${err?.message || 'unknown'}`,
      );
    }
  }
}
