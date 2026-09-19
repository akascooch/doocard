import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { normalizeIranMobile } from '../common/utils/phone.util';
import {
  FROG_REMINDER_15M_LEAD_MIN,
  FROG_REMINDER_LEAD_MIN,
  buildFrogReminderMessage,
  frogReminderWindow,
  tehranDueTime,
} from './frog-schedule.util';

type FrogWindowKind = '2h' | '15m';

@Injectable()
export class FrogReminderScheduler {
  private readonly logger = new Logger(FrogReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsOutbound: SmsOutboundService,
    @Optional() private readonly pushNotifications?: PushNotificationsService,
  ) {}

  @Cron('*/5 * * * *', { timeZone: 'Asia/Tehran' })
  async sendDueReminders() {
    try {
      const result = await this.dispatch(new Date());
      if (result.claimed > 0) {
        this.logger.log(
          `frog reminders claimed=${result.claimed} sent=${result.sent} skipped=${result.skipped}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.error(`frog reminder cron failed: ${message}`);
    }
  }

  async dispatch(now = new Date()) {
    const twoHour = await this.dispatchWindow(now, '2h');
    const fifteen = await this.dispatchWindow(now, '15m');
    return {
      claimed: twoHour.claimed + fifteen.claimed,
      sent: twoHour.sent + fifteen.sent,
      skipped: twoHour.skipped + fifteen.skipped,
      considered: twoHour.considered + fifteen.considered,
    };
  }

  private async dispatchWindow(now: Date, kind: FrogWindowKind) {
    const leadMin = kind === '2h' ? FROG_REMINDER_LEAD_MIN : FROG_REMINDER_15M_LEAD_MIN;
    const { from, to } = frogReminderWindow(now, leadMin);
    const due = await this.prisma.adminDailyFrog.findMany({
      where:
        kind === '2h'
          ? {
              isCompleted: false,
              reminder2hSent: false,
              scheduledAt: { gte: from, lte: to },
            }
          : {
              isCompleted: false,
              reminder15mSent: false,
              scheduledAt: { gte: from, lte: to },
            },
      take: 50,
    });

    let claimed = 0;
    let sent = 0;
    let skipped = 0;
    for (const task of due) {
      const marked = await this.claim(task.id, kind, now);
      if (marked.count !== 1) {
        skipped += 1;
        continue;
      }
      claimed += 1;

      const user = await this.prisma.user.findUnique({
        where: { id: task.userId },
        select: { phone: true },
      });
      const phone = user?.phone ? normalizeIranMobile(user.phone) : '';
      const dueTime = tehranDueTime(task.scheduledAt);
      const message = buildFrogReminderMessage(task.title, dueTime, leadMin);
      const eventKey =
        kind === '2h' ? SMS_EVENT_KEYS.FROG_REMINDER : SMS_EVENT_KEYS.FROG_REMINDER_15M;
      const dedupeKey = kind === '2h' ? `frog-reminder:${task.id}` : `frog-reminder-15m:${task.id}`;

      let smsOk = false;
      let smsSkipped = false;
      if (phone) {
        const result = await this.smsOutbound.sendIfAllowed({
          eventKey,
          phone,
          message,
          dedupeKey,
          skipAlwaysCc: true,
        });
        smsOk = result.success === true;
        smsSkipped = result.skipped === true;
      } else {
        smsSkipped = true;
        this.logger.warn(`frog reminder skipped SMS (no phone) id=${task.id} kind=${kind}`);
      }

      let pushSent = 0;
      try {
        const push = await this.pushNotifications?.sendToUser(task.userId, {
          title: '🐸 [قورباغه مهم]',
          body: message,
          data: {
            type: 'frog',
            frogId: task.id,
            kind,
            url: '/dashboard/admin/frog-tasks',
          },
          url: '/dashboard/admin/frog-tasks',
        });
        pushSent = push?.sent ?? 0;
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'unknown';
        this.logger.warn(`frog push failed id=${task.id}: ${detail}`);
      }

      const delivered = smsOk || smsSkipped || pushSent > 0;
      if (!delivered) {
        await this.releaseClaim(task.id, kind);
        skipped += 1;
        continue;
      }
      if (smsOk || pushSent > 0) sent += 1;
      else skipped += 1;
    }
    return { claimed, sent, skipped, considered: due.length };
  }

  private claim(id: string, kind: FrogWindowKind, now: Date) {
    if (kind === '2h') {
      return this.prisma.adminDailyFrog.updateMany({
        where: { id, reminder2hSent: false, isCompleted: false },
        data: {
          reminder2hSent: true,
          reminder2hSentAt: now,
          reminderSent: true,
          reminderSentAt: now,
        },
      });
    }
    return this.prisma.adminDailyFrog.updateMany({
      where: { id, reminder15mSent: false, isCompleted: false },
      data: { reminder15mSent: true, reminder15mSentAt: now },
    });
  }

  private releaseClaim(id: string, kind: FrogWindowKind) {
    if (kind === '2h') {
      return this.prisma.adminDailyFrog.updateMany({
        where: { id, reminder2hSent: true, isCompleted: false },
        data: {
          reminder2hSent: false,
          reminder2hSentAt: null,
          reminderSent: false,
          reminderSentAt: null,
        },
      });
    }
    return this.prisma.adminDailyFrog.updateMany({
      where: { id, reminder15mSent: true, isCompleted: false },
      data: { reminder15mSent: false, reminder15mSentAt: null },
    });
  }
}
