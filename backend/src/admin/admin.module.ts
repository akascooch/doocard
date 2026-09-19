import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { TipAlertModule } from '../sms/tip-alert.module';
import { CustomersModule } from '../customers/customers.module';
import { AdminFinancialController } from './admin-financial.controller';
import { AdminFinancialService } from './admin-financial.service';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminAnalyticsService } from './admin-analytics.service';
import { EmployeeSalaryController } from './employee-salary.controller';
import { EmployeeSalaryService } from './employee-salary.service';
import { EmployeeSalaryRequestService } from './employee-salary-request.service';
import { AdminTipsController } from './admin-tips.controller';
import { AdminTipsService } from './admin-tips.service';
import { AdminDebtorsController } from './admin-debtors.controller';

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
    NotificationsModule,
    PushNotificationsModule,
    TipAlertModule,
    CustomersModule,
  ],
  controllers: [
    AdminFinancialController,
    AdminAnalyticsController,
    EmployeeSalaryController,
    AdminTipsController,
    AdminDebtorsController,
  ],
  providers: [
    AdminFinancialService,
    AdminAnalyticsService,
    EmployeeSalaryService,
    EmployeeSalaryRequestService,
    AdminTipsService,
  ],
  exports: [EmployeeSalaryService, EmployeeSalaryRequestService, AdminTipsService],
})
export class AdminModule {}
