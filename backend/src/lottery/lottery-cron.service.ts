import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { LotteryGroupStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChequeDueSmsReminderService } from '../sms/cheque-due-sms-reminder.service';
import { LotteryService } from './lottery.service';

export const LOTTERY_CRON = '0 8 * * *';
export const LOTTERY_CRON_TZ = 'Asia/Tehran';
const COOLDOWN_MS = 5 * 60 * 1000;

@Injectable()
export class LotteryCronService {
  private readonly logger = new Logger(LotteryCronService.name);
  private readonly lastRunAt = new Map<number, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly lottery: LotteryService,
  ) {}

  isEnabled(): boolean {
    return this.config.get<string>('LOTTERY_CRON_ENABLED') === 'true';
  }

  isDryRun(): boolean {
    return this.config.get<string>('LOTTERY_CRON_DRY_RUN') === 'true';
  }

  @Cron(LOTTERY_CRON, { timeZone: LOTTERY_CRON_TZ })
  async scheduledRun(now = new Date()): Promise<void> {
    if (!this.isEnabled() && !this.isDryRun()) return;
    const ymd = ChequeDueSmsReminderService.todayYmdTehran(now);
    const day = Number(ymd.slice(8, 10));
    const groups = await this.prisma.lotteryGroup.findMany({
      where: { status: LotteryGroupStatus.ACTIVE },
      select: { id: true, cronDayOfMonth: true },
    });
    for (const group of groups) {
      const cronDay = Math.min(28, Math.max(1, group.cronDayOfMonth));
      if (day !== cronDay) continue;
      const last = this.lastRunAt.get(group.id) ?? 0;
      if (Date.now() - last < COOLDOWN_MS) continue;
      this.lastRunAt.set(group.id, Date.now());
      try {
        const result = await this.lottery.runGroupPeriod(group.id, {
          mode: this.isDryRun() || !this.isEnabled() ? 'dry-run' : 'live',
          now,
        });
        if ((result as { dryRun?: boolean }).dryRun) {
          this.logger.log(JSON.stringify({ event: 'lottery.cron.dry_run', ...result }));
        } else {
          this.logger.log(JSON.stringify({ event: 'lottery.cron.done', ...result }));
        }
      } catch (err) {
        this.logger.warn(`lottery cron group ${group.id} failed: ${(err as Error).message}`);
      }
    }
  }
}
