import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { ReconcileReminderService } from './reconcile-reminder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SmsSendModule } from '../sms/sms-send.module';

@Module({
  imports: [
    PrismaModule,
    SmsSendModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'default-secret-key',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, ReconcileReminderService],
  exports: [NotificationsService, NotificationsGateway],
})
export class NotificationsModule {}
