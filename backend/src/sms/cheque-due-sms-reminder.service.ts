import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChequeLeafStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SmsOutboundService } from './sms-outbound.service';
import { SmsTemplateService } from './sms-template.service';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';
import { SMS_EVENT_KEYS } from './sms-event-keys';

/** Hard-required reminder recipients for cheque due dates. */
export const CHEQUE_DUE_REMINDER_PHONES = ['09370504588', '09121013686'] as const;

export type ChequeDueOffsetDays = 0 | 1 | 2;

export type ChequeDueReminderPlanItem = {
  leafId: number;
  leafNumber: number;
  dueDate: string;
  offsetDays: ChequeDueOffsetDays;
  phone: string;
  dedupeKey: string;
  message: string;
};

/**
 * Daily cheque due-date reminders (T-2, T-1, T-0) via SmsOutboundService.
 * Pure planner is exportable for dry-run tests without sending.
 */
@Injectable()
export class ChequeDueSmsReminderService {
  private readonly logger = new Logger(ChequeDueSmsReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsOutbound: SmsOutboundService,
    private readonly smsTemplates: SmsTemplateService,
  ) {}

  /** Asia/Tehran calendar day bounds in UTC for a given local date. */
  static dayBoundsTehran(ymd: string): { start: Date; end: Date } {
    // ymd = YYYY-MM-DD interpreted as Tehran local midnight..end
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

  static dedupeKey(leafId: number, offsetDays: ChequeDueOffsetDays, dueYmd: string): string {
    return `cheque.due:${leafId}:T-${offsetDays}:${dueYmd}`;
  }

  /**
   * Build reminder plan for offsets relative to "today".
   * offsetDays=2 → due date is today+2, etc.
   */
  async buildPlan(options?: {
    now?: Date;
    dryRun?: boolean;
  }): Promise<ChequeDueReminderPlanItem[]> {
    const today = ChequeDueSmsReminderService.todayYmdTehran(options?.now);
    const offsets: ChequeDueOffsetDays[] = [2, 1, 0];
    const plan: ChequeDueReminderPlanItem[] = [];

    for (const offsetDays of offsets) {
      const dueYmd = ChequeDueSmsReminderService.addDaysYmd(today, offsetDays);
      const { start, end } = ChequeDueSmsReminderService.dayBoundsTehran(dueYmd);

      const leaves = await this.prisma.chequeLeaf.findMany({
        where: {
          deletedAt: null,
          status: ChequeLeafStatus.ISSUED,
          dueDate: { gte: start, lte: end },
        },
        select: {
          id: true,
          leafNumber: true,
          amount: true,
          payee: true,
          dueDate: true,
          category: true,
        },
      });

      for (const leaf of leaves) {
        const amountLabel =
          leaf.amount != null
            ? Number(leaf.amount).toLocaleString('fa-IR')
            : '—';
        const payee = leaf.payee || '—';
        const message = await this.smsTemplates.renderByKey(
          SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
          {
            offsetLabel:
              offsetDays === 0
                ? 'امروز'
                : offsetDays === 1
                  ? 'فردا'
                  : `${offsetDays} روز دیگر`,
            leafNumber: String(leaf.leafNumber),
            payee,
            amount: amountLabel,
            dueDate: dueYmd,
          },
        );

        for (const phone of CHEQUE_DUE_REMINDER_PHONES) {
          plan.push({
            leafId: leaf.id,
            leafNumber: leaf.leafNumber,
            dueDate: dueYmd,
            offsetDays,
            phone,
            dedupeKey: `${ChequeDueSmsReminderService.dedupeKey(leaf.id, offsetDays, dueYmd)}:${phone.slice(-4)}`,
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
    items: Array<Pick<ChequeDueReminderPlanItem, 'dedupeKey' | 'phone' | 'leafId' | 'offsetDays'>>;
  }> {
    const dryRun = options?.dryRun === true;
    const plan = await this.buildPlan({ now: options?.now, dryRun });
    let sent = 0;
    let skipped = 0;
    const items: Array<
      Pick<ChequeDueReminderPlanItem, 'dedupeKey' | 'phone' | 'leafId' | 'offsetDays'>
    > = [];

    for (const item of plan) {
      items.push({
        dedupeKey: item.dedupeKey,
        phone: item.phone.replace(/\d(?=\d{4})/g, '*'),
        leafId: item.leafId,
        offsetDays: item.offsetDays,
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
        // Recipients are the always-CC admins; avoid N×CC duplicates.
        skipAlwaysCc: true,
      });
      if (result.success && !result.skipped) sent += 1;
      else skipped += 1;
    }

    this.logger.log(
      `Cheque due reminders dryRun=${dryRun} planned=${plan.length} sent=${sent} skipped=${skipped}`,
    );

    return { planned: plan.length, sent, skipped, dryRun, items };
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scheduledReminders() {
    try {
      await this.runReminders({ dryRun: false });
    } catch (err: any) {
      this.logger.error(
        `Cheque due reminder cron failed: ${err?.message || 'unknown'}`,
      );
    }
  }
}
