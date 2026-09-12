import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AppThrottlerModule } from '../throttler/throttler.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmsSendModule } from '../sms/sms-send.module';
import { PublicWaitlistController, WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { StockNotificationService } from './stock-notification.service';

@Module({
  imports: [PrismaModule, AppThrottlerModule, NotificationsModule, SmsSendModule],
  controllers: [PublicWaitlistController, WaitlistController],
  providers: [WaitlistService, StockNotificationService],
  exports: [WaitlistService, StockNotificationService],
})
export class WaitlistModule {}
