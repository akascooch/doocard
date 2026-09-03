import { Module, forwardRef } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingModule } from '../accounting/accounting.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { CalendarModule } from '../calendar/calendar.module';
import { SmsSendModule } from '../sms/sms-send.module';
import { TipAlertModule } from '../sms/tip-alert.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => AccountingModule), // Avoid circular dependency
    NotificationsModule,
    PushNotificationsModule,
    CalendarModule,
    SmsSendModule, // Appointment SMS: SmsOutboundService (policy + dedupe); no Bull queue
    TipAlertModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService], // Export for use in other modules
})
export class AppointmentsModule {}
