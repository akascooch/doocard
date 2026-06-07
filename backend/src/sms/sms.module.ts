import { Module } from '@nestjs/common';
import { SmsController } from './sms.controller';
import { SmsService } from './sms.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsScheduler } from './sms.scheduler';

@Module({
  imports: [PrismaModule],
  controllers: [SmsController],
  providers: [SmsService, SmsScheduler],
  exports: [SmsService],
})
export class SmsModule {} 