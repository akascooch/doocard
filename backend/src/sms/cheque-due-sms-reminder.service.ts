import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ChequeLeafStatus, NotificationType, Prisma, UserRole } from '@prisma/client';
import { createHash } from 'crypto';
import { normalizeIranMobile } from '../common/utils/phone.util';
import * as jalaali from 'jalaali-js';
import { PrismaService } from '../prisma/prisma.service';
import { SmsOutboundService } from './sms-outbound.service';
import { SmsTemplateService } from './sms-template.service';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';
import { SMS_EVENT_KEYS } from './sms-event-keys';

export const CHEQUE_DUE_CRON = '0 8 * * *';
export const CHEQUE_DUE_CRON_TZ = 'Asia/Tehran';
export const CHEQUE_DUE_OFFSETS = [3, 2, 1, 0] as const;

/** sms_events statuses that count as already dispatched for a dedupe key (no resend). */
const DISPATCHED_STATUSES = new Set(['SENT', 'PENDING']);

export function maskPhone(phone: string): string {
  return phone.replace(/\d(?=\d{4})/g, '*');
}

export type ChequeDueOffsetDays = (typeof CHEQUE_DUE_OFFSETS)[number];
export type ChequeReminderStage = 't_minus_3' | 't_minus_2' | 't_minus_1' | 't_zero';

export type ChequeReminderRecipient = {
  userId: number;
  name: string;
  phone: string;
};

export type ChequeDueReminderPlanItem = {
  leafId: number;
  leafNumber: number;
  dueDate: string;
  jalaliDueDate: string;
  offsetDays: ChequeDueOffsetDays;
  stage: ChequeReminderStage;
  userId: number;
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
 * Daily cheque due-date reminders (T-3 through T-0) to active ADMIN users, 08:00 Asia/Tehran.
 * Each run plans only the offset whose due day is that many days ahead.
 * A missed earlier offset is not replayed, and a past due date is not backfilled.
 * Sending requires CHEQUE_DUE_SMS_ENABLED === 'true' (plus SMS_ENABLED and the event policy).
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
   * ADMIN users that are not deactivated staff, with a valid Iranian mobile, one entry per
   * unique phone. Users have no active flag of their own; an ADMIN who also has an Employee
   * row counts as active only while that row is active.
   */
  async getActiveAdminRecipients(): Promise<ChequeReminderRecipient[]> {
    const admins = await this.prisma.user.findMany({
      where: {
        role: UserRole.ADMIN,
        OR: [{ employee: { is: null } }, { employee: { is: { isActive: true } } }],
      },
      select: { id: true, name: true, phone: true },
      orderBy: { id: 'asc' },
    });
    const byPhone = new Map<string, ChequeReminderRecipient>();
    let invalid = 0;
    for (const admin of admins) {
      const phone = normalizeIranMobile(admin.phone);
      if (!phone || !/^09[0-9]{9}$/.test(phone)) {
        invalid += 1;
        continue;
      }
      if (!byPhone.has(phone)) {
        byPhone.set(phone, { userId: admin.id, name: admin.name, phone });
      }
    }
    if (invalid > 0) {
      this.logger.warn(
        JSON.stringify({
          event: 'cheque_due_reminder.invalid_admin_phones',
          activeAdmins: admins.length,
          invalidPhones: invalid,
        }),
      );
    }
    return [...byPhone.values()];
  }

  /** Asia/Tehran calendar day bounds in UTC for a given local date (Iran has no DST since 2022). */
  static dayBoundsTehran(ymd: string): { start: Date; end: Date } {
    const start = new Date(`${ymd}T00:00:00+03:30`);
    const end = new Date(`${ymd}T23:59:59.999+03:30`);
    return { start, end };
  }

  /** Pure calendar arithmetic; independent of the process timezone. */
  static addDaysYmd(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
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

  /**
   * One key per (cheque, offset, due-date cycle, recipient phone). sms_events.to is masked, so the
   * phone identity lives here: last 4 digits for operators plus a hash so equal suffixes never collide.
   */
  static dedupeKey(
    leafId: number,
    stage: ChequeReminderStage,
    jalaliDueDate: string,
    phone: string,
  ): string {
    const tag = createHash('sha256').update(phone).digest('hex').slice(0, 12);
    return `${ChequeDueSmsReminderService.relatedEntityKey(leafId, stage, jalaliDueDate)}:${phone.slice(-4)}.${tag}`;
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

  /** Issued (unpaid) leaves due on each T-3..T-0 Tehran day. Reads only. */
  async findDueLeavesByOffset(now = new Date()) {
    const today = ChequeDueSmsReminderService.todayYmdTehran(now);
    const windows: Array<{
      offsetDays: ChequeDueOffsetDays;
      stage: ChequeReminderStage;
      dueDate: string;
      jalaliDueDate: string;
      start: Date;
      end: Date;
      leaves: ReminderLeaf[];
    }> = [];
    for (const offsetDays of CHEQUE_DUE_OFFSETS) {
      const dueDate = ChequeDueSmsReminderService.addDaysYmd(today, offsetDays);
      const { start, end } = ChequeDueSmsReminderService.dayBoundsTehran(dueDate);
      const leaves = await this.prisma.chequeLeaf.findMany({
        where: {
          deletedAt: null,
          status: ChequeLeafStatus.ISSUED,
          dueDate: { gte: start, lte: end },
          chequebook: { deletedAt: null },
        },
        select: REMINDER_LEAF_SELECT,
        orderBy: { id: 'asc' },
      });
      windows.push({
        offsetDays,
        stage: ChequeDueSmsReminderService.stageForOffset(offsetDays),
        dueDate,
        jalaliDueDate: ChequeDueSmsReminderService.gregorianYmdToJalali(dueDate),
        start,
        end,
        leaves,
      });
    }
    return { today, windows };
  }

  /** Send plan (cheque x recipient) for today's T-3..T-0 windows. Reads only; never sends. */
  async buildPlan(
    recipients: ChequeReminderRecipient[],
    now = new Date(),
  ): Promise<ChequeDueReminderPlanItem[]> {
    const { windows } = await this.findDueLeavesByOffset(now);
    return this.planForWindows(recipients, windows);
  }

  private async planForWindows(
    recipients: ChequeReminderRecipient[],
    windows: Awaited<ReturnType<ChequeDueSmsReminderService['findDueLeavesByOffset']>>['windows'],
  ): Promise<ChequeDueReminderPlanItem[]> {
    const plan: ChequeDueReminderPlanItem[] = [];
    for (const w of windows) {
      for (const leaf of w.leaves) {
        const message = await this.renderLeafMessage(leaf, STAGE_LABEL_FA[w.stage], w.jalaliDueDate);
        const relatedEntity = ChequeDueSmsReminderService.relatedEntityKey(
          leaf.id,
          w.stage,
          w.jalaliDueDate,
        );
        for (const r of recipients) {
          plan.push({
            leafId: leaf.id,
            leafNumber: leaf.leafNumber,
            dueDate: w.dueDate,
            jalaliDueDate: w.jalaliDueDate,
            offsetDays: w.offsetDays,
            stage: w.stage,
            userId: r.userId,
            phone: r.phone,
            relatedEntity,
            dedupeKey: ChequeDueSmsReminderService.dedupeKey(
              leaf.id,
              w.stage,
              w.jalaliDueDate,
              r.phone,
            ),
            message,
          });
        }
      }
    }
    return plan;
  }

  /** Existing sms_events status per dedupe key (one query). */
  private async existingStatuses(keys: string[]): Promise<Map<string, string>> {
    if (keys.length === 0) return new Map();
    const rows = await this.prisma.smsEvent.findMany({
      where: { dedupeKey: { in: keys } },
      select: { dedupeKey: true, status: true },
    });
    return new Map(rows.map((r) => [r.dedupeKey as string, r.status]));
  }

  async runReminders(options?: { now?: Date; dryRun?: boolean }): Promise<{
    planned: number;
    sent: number;
    skipped: number;
    alreadySent: number;
    dryRun: boolean;
    items: Array<
      Pick<ChequeDueReminderPlanItem, 'dedupeKey' | 'phone' | 'leafId' | 'offsetDays' | 'stage'>
    >;
  }> {
    const empty = { planned: 0, sent: 0, skipped: 0, alreadySent: 0, dryRun: true, items: [] };
    if (!this.isChequeDueSmsEnabled()) {
      this.logger.log('Cheque due SMS skipped (CHEQUE_DUE_SMS_ENABLED is not true)');
      return empty;
    }

    const recipients = await this.getActiveAdminRecipients();
    if (recipients.length === 0) {
      this.logger.warn(
        JSON.stringify({
          event: 'cheque_due_reminder.aborted',
          reason: 'no_active_admin_with_valid_phone',
        }),
      );
      return empty;
    }

    const dryRun = options?.dryRun === true;
    const plan = await this.buildPlan(recipients, options?.now);
    const statuses = await this.existingStatuses(plan.map((p) => p.dedupeKey));
    let sent = 0;
    let skipped = 0;
    let alreadySent = 0;
    const items: Array<
      Pick<ChequeDueReminderPlanItem, 'dedupeKey' | 'phone' | 'leafId' | 'offsetDays' | 'stage'>
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
      const existing = statuses.get(item.dedupeKey);
      if (existing && DISPATCHED_STATUSES.has(existing)) {
        alreadySent += 1;
        this.logger.debug(`Cheque reminder already dispatched (${existing}) ${item.dedupeKey}`);
        continue;
      }
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
      } else if (result.reason === 'already sent') {
        alreadySent += 1;
      } else {
        skipped += 1;
      }
    }

    this.logger.log(
      `Cheque due reminders dryRun=${dryRun} recipients=${recipients.length} planned=${plan.length} sent=${sent} alreadySent=${alreadySent} skipped=${skipped}`,
    );

    return { planned: plan.length, sent, skipped, alreadySent, dryRun, items };
  }

  /** Read-only preview for admins. Works with CHEQUE_DUE_SMS_ENABLED off; never sends. */
  async previewPlan(options?: { now?: Date }) {
    const now = options?.now ?? new Date();
    const recipients = await this.getActiveAdminRecipients();
    const { today, windows } = await this.findDueLeavesByOffset(now);
    const plan = await this.planForWindows(recipients, windows);
    const statuses = await this.existingStatuses(plan.map((p) => p.dedupeKey));
    const items = plan.map((item) => {
      const lastStatus = statuses.get(item.dedupeKey) ?? null;
      return {
        leafId: item.leafId,
        leafNumber: item.leafNumber,
        dueDate: item.dueDate,
        jalaliDueDate: item.jalaliDueDate,
        offsetDays: item.offsetDays,
        stage: item.stage,
        userId: item.userId,
        phone: maskPhone(item.phone),
        dedupeKey: item.dedupeKey,
        dispatch: lastStatus && DISPATCHED_STATUSES.has(lastStatus) ? 'sent' : 'pending',
        lastStatus,
      };
    });
    return {
      enabled: this.isChequeDueSmsEnabled(),
      schedule: { cron: CHEQUE_DUE_CRON, timeZone: CHEQUE_DUE_CRON_TZ },
      today,
      todayJalali: ChequeDueSmsReminderService.gregorianYmdToJalali(today),
      recipients: recipients.map((r) => ({
        userId: r.userId,
        name: r.name,
        phone: maskPhone(r.phone),
      })),
      offsets: windows.map((w) => ({
        offsetDays: w.offsetDays,
        stage: w.stage,
        dueDate: w.dueDate,
        jalaliDueDate: w.jalaliDueDate,
        windowStart: w.start.toISOString(),
        windowEnd: w.end.toISOString(),
        leafIds: w.leaves.map((l) => l.id),
      })),
      count: items.length,
      sentCount: items.filter((i) => i.dispatch === 'sent').length,
      pendingCount: items.filter((i) => i.dispatch === 'pending').length,
      items,
    };
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

  @Cron(CHEQUE_DUE_CRON, { timeZone: CHEQUE_DUE_CRON_TZ })
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
