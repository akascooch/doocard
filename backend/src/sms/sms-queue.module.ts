import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { SmsServiceEnhanced } from './sms.service.enhanced';
import { SmsQueueProcessor } from './sms-queue.processor';
import { FarazSdkAdapter } from './adapters/faraz-sdk.adapter';
import { FarazHttpAdapter } from './adapters/faraz-http.adapter';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    PrismaModule,
    BullModule.registerQueueAsync({
      name: 'sms',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', '127.0.0.1'),
          port: configService.get('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5 seconds base delay
          },
          removeOnComplete: false, // Keep completed jobs for audit
          removeOnFail: false, // Keep failed jobs for debugging
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    SmsServiceEnhanced,
    SmsQueueProcessor,
    FarazSdkAdapter,
    FarazHttpAdapter,
  ],
  exports: [SmsServiceEnhanced, BullModule],
})
export class SmsQueueModule {}

