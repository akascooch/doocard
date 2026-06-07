import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FarazSmsSendService } from './faraz-sms-send.service';

/**
 * Minimal module for sending single SMS (appointment-created only).
 * No queue, no templates, no business logic.
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 0,
    }),
  ],
  providers: [FarazSmsSendService],
  exports: [FarazSmsSendService],
})
export class SmsSendModule {}
