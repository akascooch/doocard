import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmsSendModule } from './sms-send.module';
import { TipAlertService } from './tip-alert.service';

/**
 * Tip in-app + SMS alerts. Separate from SmsSendModule to avoid
 * NotificationsModule ↔ SmsSendModule circular DI.
 */
@Module({
  imports: [PrismaModule, SmsSendModule, NotificationsModule],
  providers: [TipAlertService],
  exports: [TipAlertService],
})
export class TipAlertModule {}
