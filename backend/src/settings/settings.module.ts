import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { FinancialReportsAccessService } from './financial-reports-access.service';
import { FinancialReportsAccessGuard } from '../common/guards/financial-reports-access.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { BackupModule } from '../backup/backup.module';

@Module({
  imports: [
    PrismaModule,
    BackupModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT secret is not defined');
        }
        return { secret };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, FinancialReportsAccessService, FinancialReportsAccessGuard],
  exports: [FinancialReportsAccessService, FinancialReportsAccessGuard],
})
export class SettingsModule {} 