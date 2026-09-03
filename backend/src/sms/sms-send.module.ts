import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../prisma/prisma.module';
import { FarazSmsSendService } from './faraz-sms-send.service';
import { SmsIrHttpAdapter } from './adapters/smsir-http.adapter';
import { SmsNotificationPolicyService } from './sms-notification-policy.service';
import { SmsOutboundService } from './sms-outbound.service';
import { SmsAdminController } from './sms-admin.controller';
import { SmsTemplateService } from './sms-template.service';
import { ChequeDueSmsReminderService } from './cheque-due-sms-reminder.service';

/**
 * Shared SMS send + policy + admin endpoints.
 * TipAlertService lives in TipAlertModule (needs NotificationsModule).
 */
@Module({
  imports: [
    PrismaModule,
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 0,
    }),
  ],
  controllers: [SmsAdminController],
  providers: [
    SmsIrHttpAdapter,
    FarazSmsSendService,
    SmsNotificationPolicyService,
    SmsOutboundService,
    SmsTemplateService,
    ChequeDueSmsReminderService,
  ],
  exports: [
    FarazSmsSendService,
    SmsIrHttpAdapter,
    SmsNotificationPolicyService,
    SmsOutboundService,
    SmsTemplateService,
    ChequeDueSmsReminderService,
  ],
})
export class SmsSendModule {}