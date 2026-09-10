import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SmsSendModule } from '../sms/sms-send.module';
import { AppThrottlerModule } from '../throttler/throttler.module';

@Module({
  imports: [PrismaModule, NotificationsModule, SmsSendModule, AppThrottlerModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
