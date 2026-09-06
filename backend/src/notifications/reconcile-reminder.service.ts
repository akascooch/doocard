import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SmsTemplateService } from '../sms/sms-template.service';
import { SMS_TEMPLATE_KEYS } from '../sms/sms-template.catalog';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';

export type ReconcileSlot = '13' | '20';

export type ReconcilePlanItem = {
  userId: number;
  employeeId: number;
  name: string;
  phone: string | null;
  slot: ReconcileSlot;
  tehranYmd: string;
  dedupeKey: string;
  message: string;
};

/**
 * Daily account-reconciliation reminders at 13:00 and 20:00 Asia/Tehran.
 * In-app + SMS. Push skipped. Does not use SmsQueueModule.
 */
@Injectable()
export class ReconcileReminderService {
  private readonly logger = new Logger(ReconcileReminderService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly smsOutbound: SmsOutboundService,
    private readonly smsTemplates: SmsTemplateService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('RECONCILE_REMINDER_ENABLED', 'true') !== 'false';
  }

  isDryRunEnv(): boolean {
    return this.config.get<string>('RECONCILE_REMINDER_DRY_RUN', 'false') === 'true';
  }

  static todayYmdTehran(now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }

  static dedupeKey(slot: ReconcileSlot, tehranYmd: string, userId: number): string {
    return `reconcile:${slot}:${tehranYmd}:${userId}`;
  }

  async buildPlan(slot: ReconcileSlot, now = new Date()): Promise<ReconcilePlanItem[]> {
    const tehranYmd = ReconcileReminderService.todayYmdTehran(now);
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, name: true, phone: true, role: true } },
      },
    });

    const plan: ReconcilePlanItem[] = [];
    for (const emp of employees) {
      const role = emp.user?.role;
      if (role !== 'EMPLOYEE' && role !== 'SERVICE') continue;
      const userId = emp.user?.id ?? emp.userId;
      if (!userId) continue;
      const name = (emp.user?.name || 'همکار').trim();
      const message = await this.smsTemplates.renderByKey(
        SMS_TEMPLATE_KEYS.ACCOUNT_RECONCILE_REMINDER,
        { name },
      );
      plan.push({
        userId,
        employeeId: emp.id,
        name,
        phone: emp.user?.phone?.trim() || null,
        slot,
        tehranYmd,
        dedupeKey: ReconcileReminderService.dedupeKey(slot, tehranYmd, userId),
        message,
      });
    }
    return plan;
  }

  async runSlot(
    slot: ReconcileSlot,
    options?: { now?: Date; dryRun?: boolean },
  ): Promise<{
    planned: number;
    notified: number;
    smsSent: number;
    skipped: number;
    dryRun: boolean;
    items: Array<Pick<ReconcilePlanItem, 'dedupeKey' | 'userId' | 'slot'>>;
  }> {
    const dryRun = options?.dryRun === true || this.isDryRunEnv();
    if (!this.isEnabled() && options?.dryRun !== true) {
      this.logger.log('Reconcile reminders skipped (RECONCILE_REMINDER_ENABLED=false)');
      return { planned: 0, notified: 0, smsSent: 0, skipped: 0, dryRun: true, items: [] };
    }

    const plan = await this.buildPlan(slot, options?.now);
    let notified = 0;
    let smsSent = 0;
    let skipped = 0;
    const items: Array<Pick<ReconcilePlanItem, 'dedupeKey' | 'userId' | 'slot'>> = [];

    const title = 'یادآوری بررسی حساب';

    for (const item of plan) {
      items.push({ dedupeKey: item.dedupeKey, userId: item.userId, slot: item.slot });
      if (dryRun) {
        skipped += 1;
        continue;
      }

      try {
        const existing = await this.prisma.notification.findFirst({
          where: { relatedEntity: item.dedupeKey, userIdTarget: item.userId },
        });
        if (!existing) {
          const notification = await this.notifications.create({
            title,
            message: item.message,
            type: NotificationType.ACCOUNT_RECONCILE_REMINDER,
            userIdTarget: item.userId,
            relatedEntity: item.dedupeKey,
          });
          this.gateway.sendToUser(item.userId, notification);
          notified += 1;
        } else {
          skipped += 1;
        }
      } catch (err: any) {
        this.logger.warn(
          `Reconcile in-app failed user=${item.userId}: ${err?.message || 'unknown'}`,
        );
      }

      if (!item.phone) continue;
      try {
        const result = await this.smsOutbound.sendIfAllowed({
          eventKey: SMS_EVENT_KEYS.ACCOUNT_RECONCILE_REMINDER,
          phone: item.phone,
          message: item.message,
          dedupeKey: item.dedupeKey,
          templateKey: SMS_TEMPLATE_KEYS.ACCOUNT_RECONCILE_REMINDER,
        });
        if (result.success && !result.skipped) smsSent += 1;
      } catch (err: any) {
        this.logger.warn(
          `Reconcile SMS failed user=${item.userId}: ${err?.message || 'unknown'}`,
        );
      }
    }

    this.logger.log(
      `Reconcile slot=${slot} dryRun=${dryRun} planned=${plan.length} notified=${notified} smsSent=${smsSent} skipped=${skipped}`,
    );
    return { planned: plan.length, notified, smsSent, skipped, dryRun, items };
  }

  @Cron('0 13 * * *', { timeZone: 'Asia/Tehran' })
  async scheduledAt13() {
    try {
      await this.runSlot('13');
    } catch (err: any) {
      this.logger.error(`Reconcile 13:00 cron failed: ${err?.message || 'unknown'}`);
    }
  }

  @Cron('0 20 * * *', { timeZone: 'Asia/Tehran' })
  async scheduledAt20() {
    try {
      await this.runSlot('20');
    } catch (err: any) {
      this.logger.error(`Reconcile 20:00 cron failed: ${err?.message || 'unknown'}`);
    }
  }
}
