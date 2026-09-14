import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AdminPersonalService } from './admin-personal.service';

@Injectable()
export class FrogRecurrenceScheduler {
  private readonly logger = new Logger(FrogRecurrenceScheduler.name);

  constructor(private readonly service: AdminPersonalService) {}

  @Cron('0 4 * * *', { timeZone: 'Asia/Tehran' })
  async applyAtFourAmTehran() {
    try {
      const result = await this.service.applyDueRecurrences();
      this.logger.log(
        `frog recurrences applied today=${result.today} created=${result.created} skipped=${result.skipped}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';
      this.logger.error(`frog recurrence cron failed: ${message}`);
    }
  }
}
