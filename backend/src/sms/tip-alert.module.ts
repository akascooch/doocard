import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { TipAlertService } from './tip-alert.service';

/**
 * Tip in-app + Socket.IO + push alerts. SMS is not sent (zero SMS cost).
 */
@Module({
  imports: [PrismaModule, NotificationsModule, PushNotificationsModule],
  providers: [TipAlertService],
  exports: [TipAlertService],
})
export class TipAlertModule {}
