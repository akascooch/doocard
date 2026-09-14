import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsSendModule } from '../sms/sms-send.module';
import { AdminPersonalController } from './admin-personal.controller';
import { AdminPersonalService } from './admin-personal.service';
import { FrogRecurrenceScheduler } from './frog-recurrence.scheduler';
import { FrogReminderScheduler } from './frog-reminder.scheduler';

@Module({
  imports: [PrismaModule, SmsSendModule],
  controllers: [AdminPersonalController],
  providers: [AdminPersonalService, FrogRecurrenceScheduler, FrogReminderScheduler],
})
export class AdminPersonalModule {}
