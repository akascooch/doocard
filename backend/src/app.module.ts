import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { join } from 'path';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseTimeInterceptor } from './common/interceptors/response-time.interceptor';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CustomersModule } from './customers/customers.module';
import { EmployeesModule } from './employees/employees.module';
import { HomepageModule } from './homepage/homepage.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AccountingModule } from './accounting/accounting.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AdminModule } from './admin/admin.module';
import { DayClosingModule } from './day-closing/day-closing.module';
// import { SettingsModule } from './settings/settings.module';
// import { SmsModule } from './sms/sms.module';
// import { PermissionsModule } from './permissions/permissions.module';
import { PrismaModule } from './prisma/prisma.module';
import { AppThrottlerModule } from './throttler/throttler.module';
import { AppCacheModule } from './cache/cache.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { AppLoggerModule } from './logger/logger.module';
import { HealthModule } from './health/health.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PushNotificationsModule } from './push-notifications/push-notifications.module';
import { ImportModule } from './import/import.module';
import { CalendarModule } from './calendar/calendar.module';
import { SmsQueueModule } from './sms/sms-queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads',
    }),
         AppThrottlerModule,
    AppCacheModule,
    MonitoringModule,
    AppLoggerModule,
    HealthModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    CustomersModule,
    EmployeesModule,
    HomepageModule,
    ServicesModule,
    AppointmentsModule,
    AccountingModule,
    DashboardModule,
    AdminModule,
    DayClosingModule,
    NotificationsModule,
    PushNotificationsModule,
    ImportModule,
    CalendarModule,
    SmsQueueModule, // SMS queue for automatic notifications
    // SettingsModule,
    // SmsModule,
    // PermissionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseTimeInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
