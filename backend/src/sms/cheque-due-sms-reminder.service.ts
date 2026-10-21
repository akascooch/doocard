import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ChequeLeafStatus, NotificationType, Prisma, UserRole } from '@prisma/client';
import { normalizeIranMobile } from '../common/utils/phone.util';
import * as jalaali from 'jalaali-js';
import { PrismaService } from '../prisma/prisma.service';
import { SmsOutboundService } from './sms-outbound.service';
import { SmsTemplateService } from './sms-template.service';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';
import { SMS_EVENT_KEYS } from './sms-event-keys';

/** Hard-required reminder recipients for cheque due dates. */
export const CHEQUE_DUE_REMINDER_PHONES = ['09370504588', '09121013686'] as const;

/** Upper bound on CHEQUE_DUE_SMS_TEST_PHONES; a longer list is treated as misconfiguration. */
export const CHEQUE_DUE_TEST_PHONES_MAX = 3;
export const CHEQUE_DUE_TEST_MESSAGE_PREFIX = '[پیام آزمایشی]';

export function maskPhone(phone: string): string {
  return phone.replace(/\d(?=\d{4})/g, '*');
}

export type ChequeDueOffsetDays = 0 | 1 | 2 | 3;
export type ChequeReminderStage = 't_minus_3' | 't_minus_2' | 't_minus_1' | 't_zero';

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
  3: 't_minus_3',
  2: 't_minus_2',
  1: 't_minus_1',
  0: 't_zero',
};

const REMINDER_LEAF_SELECT = {
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
} satisfies Prisma.ChequeLeafSelect;

type ReminderLeaf = Prisma.ChequeLeafGetPayload<{ select: typeof REMINDER_LEAF_SELECT }>;

const STAGE_LABEL_FA: Record<ChequeReminderStage, string> = {
  t_minus_3: '۳ روز آینده',
  t_minus_2: '۲ روز آینده',
  t_minus_1: 'فردا',
  t_zero: 'امروز',
};

/**
 * Daily cheque due-date reminders (T-3 through T-0) via SmsOutboundService.
 * Each run plans only the offset whose due day is that many days ahead.
 * A missed earlier offset is not replayed, and a past due date is not backfilled.
 * Sending still requires CHEQUE_DUE_SMS_ENABLED === 'true'.
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

  /**
   * Default off. The hardcoded recipient list stays in use until this is exactly "true".
   * Does not turn sending on; CHEQUE_DUE_SMS_ENABLED remains the send kill-switch.
   */
  isRoleRecipientMode(): boolean {
    return this.config.get<string>('CHEQUE_DUE_SMS_USE_ROLE_RECIPIENTS') === 'true';
  }

  /**
   * Test mode is on whenever CHEQUE_DUE_SMS_TEST_PHONES is non-empty. Recipients are then
   * this allowlist only (role recipients and the hardcoded list are ignored). Invalid
   * entries are dropped, never replaced, so a bad value yields zero recipients.
   */
  isTestMode(): boolean {
    return (this.config.get<string>('CHEQUE_DUE_SMS_TEST_PHONES') || '').trim().length > 0;
  }

  testPhones(): string[] {
    const raw = this.config.get<string>('CHEQUE_DUE_SMS_TEST_PHONES') || '';
    const phones = new Set<string>();
    for (const part of raw.split(/[\s,;]+/)) {
      const phone = normalizeIranMobile(part);
      if (phone) phones.add(phone);
    }
    return [...phones];
  }

  async resolveReminderPhones(): Promise<string[]> {
    if (this.isTestMode()) {
      const phones = this.testPhones();
      if (phones.length > CHEQUE_DUE_TEST_PHONES_MAX) {
        this.logger.warn(
          `CHEQUE_DUE_SMS_TEST_PHONES has ${phones.length} numbers (max ${CHEQUE_DUE_TEST_PHONES_MAX}); no recipients`,
        );
        return [];
      }
      return phones;
    }
    if (!this.isRoleRecipientMode()) {
      return [...CHEQUE_DUE_REMINDER_PHONES];
    }
    const roles: UserRole[] = [UserRole.ADMIN];
    if (this.config.get<string>('CHEQUE_DUE_SMS_INCLUDE_ACCOUNTANT') === 'true') {
      roles.push(UserRole.ACCOUNTANT);
    }
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles } },
      select: { phone: true },
    });
    const phones = new Set<string>();
    for (const user of users) {
      const phone = normalizeIranMobile(user.phone || '');
      if (phone) phones.add(phone);
    }
    return [...phones];
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

  private async renderLeafMessage(
    leaf: ReminderLeaf,
    stageLabel: string,
    jalaliDueDate: string,
  ): Promise<string> {
    const { bankName, branch, accountNumber } =
      ChequeDueSmsReminderService.formatBankDetails(leaf.chequebook?.bankAccount);
    const chequeBookSerial = ChequeDueSmsReminderService.formatChequeBookSerial(
      leaf.chequebook,
    );
    const amountLabel = ChequeDueSmsReminderService.formatAmountRial(leaf.amount);
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
    return (
      rendered?.trim() ||
      [
        `دوکارد — یادآوری موعد چک (${stageLabel})`,
        `بانک: ${bankName}`,
        `شعبه: ${branch}`,
        `دسته چک: ${chequeBookSerial}`,
        `شماره برگ: ${leaf.leafNumber}`,
        `مبلغ: ${amountLabel}`,
        `سررسید: ${jalaliDueDate}`,
      ].join('\n')
    );
  }

  /** Send plan for today's T-maxOffset..T-0 window. Reads only; never sends. */
  buildChequeReminderPlan(now = new Date(), maxOffsetDays: ChequeDueOffsetDays = 3) {
    return this.buildPlan({ now, maxOffsetDays });
  }

  async buildPlan(options?: {
    now?: Date;
    dryRun?: boolean;
    maxOffsetDays?: ChequeDueOffsetDays;
  }): Promise<ChequeDueReminderPlanItem[]> {
    const today = ChequeDueSmsReminderService.todayYmdTehran(options?.now);
    const maxOffset = options?.maxOffsetDays ?? 3;
    const offsets = ([3, 2, 1, 0] as ChequeDueOffsetDays[]).filter((o) => o <= maxOffset);
    const phones = await this.resolveReminderPhones();
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
        select: REMINDER_LEAF_SELECT,
      });

      for (const leaf of leaves) {
        const message = await this.renderLeafMessage(leaf, STAGE_LABEL_FA[stage], jalaliDueDate);

        const relatedEntity = ChequeDueSmsReminderService.relatedEntityKey(
          leaf.id,
          stage,
          jalaliDueDate,
        );

        for (const phone of phones) {
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
        phone: maskPhone(item.phone),
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
      `Cheque due reminders dryRun=${dryRun} testMode=${this.isTestMode()} planned=${plan.length} sent=${sent} skipped=${skipped}`,
    );

    return { planned: plan.length, sent, skipped, dryRun, items };
  }

  /** Read-only preview for admins. Works with CHEQUE_DUE_SMS_ENABLED off; never sends. */
  async previewPlan(options?: { now?: Date; days?: number }) {
    const days = Math.min(3, Math.max(0, Math.trunc(Number(options?.days ?? 3)) || 0));
    const plan = await this.buildChequeReminderPlan(
      options?.now ?? new Date(),
      days as ChequeDueOffsetDays,
    );
    const recipients = [...new Set(plan.map((item) => item.phone))];
    return {
      enabled: this.isChequeDueSmsEnabled(),
      testMode: this.isTestMode(),
      roleRecipientMode: this.isRoleRecipientMode(),
      days,
      count: plan.length,
      recipients: recipients.map(maskPhone),
      leafIds: [...new Set(plan.map((item) => item.leafId))],
      items: plan.map((item) => ({
        leafId: item.leafId,
        leafNumber: item.leafNumber,
        jalaliDueDate: item.jalaliDueDate,
        offsetDays: item.offsetDays,
        stage: item.stage,
        phone: maskPhone(item.phone),
        dedupeKey: item.dedupeKey,
      })),
    };
  }

  /**
   * Controlled real send for verification. Requires CHEQUE_DUE_SMS_TEST_PHONES and sends
   * at most one message per allowlisted phone per leaf per Tehran day. Uses its own
   * dedupe namespace so the real T-n reminder for the same leaf is not consumed.
   * Independent of CHEQUE_DUE_SMS_ENABLED; SMS_ENABLED and the event policy still apply.
   */
  async sendTestReminder(options: { leafId?: number; now?: Date }) {
    if (!this.isTestMode()) {
      throw new BadRequestException('CHEQUE_DUE_SMS_TEST_PHONES تنظیم نشده است');
    }
    const phones = this.testPhones();
    if (phones.length === 0) {
      throw new BadRequestException('شماره معتبری در CHEQUE_DUE_SMS_TEST_PHONES نیست');
    }
    if (phones.length > CHEQUE_DUE_TEST_PHONES_MAX) {
      throw new BadRequestException(
        `حداکثر ${CHEQUE_DUE_TEST_PHONES_MAX} شماره تست مجاز است`,
      );
    }

    const now = options.now ?? new Date();
    const today = ChequeDueSmsReminderService.todayYmdTehran(now);
    const leaf = await this.prisma.chequeLeaf.findFirst({
      where: {
        deletedAt: null,
        status: ChequeLeafStatus.ISSUED,
        chequebook: { deletedAt: null },
        ...(options.leafId
          ? { id: options.leafId }
          : { dueDate: { gte: ChequeDueSmsReminderService.dayBoundsTehran(today).start } }),
      },
      orderBy: { dueDate: 'asc' },
      select: REMINDER_LEAF_SELECT,
    });
    if (!leaf?.dueDate) {
      throw new NotFoundException('چک صادرشدهٔ سررسید‌داری برای تست یافت نشد');
    }

    const dueYmd = ChequeDueSmsReminderService.todayYmdTehran(leaf.dueDate);
    const jalaliDueDate = ChequeDueSmsReminderService.gregorianYmdToJalali(dueYmd);
    const offset = Math.round(
      (Date.parse(`${dueYmd}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
    );
    const stageLabel =
      offset >= 0 && offset <= 3
        ? STAGE_LABEL_FA[STAGE_BY_OFFSET[offset as ChequeDueOffsetDays]]
        : `${offset.toLocaleString('fa-IR')} روز`;
    const body = await this.renderLeafMessage(leaf, stageLabel, jalaliDueDate);
    const message = `${CHEQUE_DUE_TEST_MESSAGE_PREFIX}\n${body}`;

    const results: Array<{ phone: string; dedupeKey: string; sent: boolean; reason?: string }> = [];
    for (const phone of phones) {
      const dedupeKey = `cheque:reminder-test:${leaf.id}:${today}:${phone.slice(-4)}`;
      const result = await this.smsOutbound.sendIfAllowed({
        eventKey: SMS_EVENT_KEYS.CHEQUE_DUE_REMINDER,
        phone,
        message,
        dedupeKey,
        templateKey: SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
        skipAlwaysCc: true,
      });
      results.push({
        phone: maskPhone(phone),
        dedupeKey,
        sent: Boolean(result.success && !result.skipped),
        ...(result.reason ? { reason: result.reason } : {}),
      });
    }

    this.logger.log(
      `Cheque due TEST send leaf=${leaf.id} phones=${results.map((r) => r.phone).join(',')} sent=${results.filter((r) => r.sent).length}`,
    );
    return { leafId: leaf.id, jalaliDueDate, results };
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
