import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BarbersModule } from './barbers/barbers.module';
import { CustomersModule } from './customers/customers.module';
import { ServicesModule } from './services/services.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { SmsModule } from './sms/sms.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AccountingModule } from './accounting/accounting.module';
import { SettingsModule } from './settings/settings.module';
import { PermissionsModule } from './permissions/permissions.module';
import config from './config/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
      load: [config],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    BarbersModule,
    CustomersModule,
    ServicesModule,
    AppointmentsModule,
    SmsModule,
    DashboardModule,
    AccountingModule,
    SettingsModule,
    PermissionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
