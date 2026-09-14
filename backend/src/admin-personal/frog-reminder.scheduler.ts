import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';
import { normalizeIranMobile } from '../common/utils/phone.util';
import {
  buildFrogReminderMessage,
  frogReminderWindow,
  tehranDueTime,
} from './frog-schedule.util';

@Injectable()
export class FrogReminderScheduler {
  private readonly logger = new Logger(FrogReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsOutbound: SmsOutboundService,
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
    const { from, to } = frogReminderWindow(now);
    const due = await this.prisma.adminDailyFrog.findMany({
      where: {
        isCompleted: false,
        reminderSent: false,
        scheduledAt: { gte: from, lte: to },
      },
      take: 50,
    });

    let claimed = 0;
    let sent = 0;
    let skipped = 0;
    for (const task of due) {
      const marked = await this.prisma.adminDailyFrog.updateMany({
        where: { id: task.id, reminderSent: false, isCompleted: false },
        data: { reminderSent: true, reminderSentAt: now },
      });
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
      if (!phone) {
        skipped += 1;
        this.logger.warn(`frog reminder skipped (no phone) id=${task.id}`);
        continue;
      }

      const dueTime = tehranDueTime(task.scheduledAt);
      const result = await this.smsOutbound.sendIfAllowed({
        eventKey: SMS_EVENT_KEYS.FROG_REMINDER,
        phone,
        message: buildFrogReminderMessage(task.title, dueTime),
        dedupeKey: `frog-reminder:${task.id}`,
        skipAlwaysCc: true,
      });
      if (result.success) sent += 1;
      else skipped += 1;
    }
    return { claimed, sent, skipped, considered: due.length };
  }
}
