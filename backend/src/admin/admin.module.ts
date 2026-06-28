import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AdminFinancialController } from './admin-financial.controller';
import { AdminFinancialService } from './admin-financial.service';
import { EmployeeSalaryController } from './employee-salary.controller';
import { EmployeeSalaryService } from './employee-salary.service';

@Module({
  imports: [PrismaModule, SettingsModule],
  controllers: [AdminFinancialController, EmployeeSalaryController],
  providers: [AdminFinancialService, EmployeeSalaryService],
  exports: [EmployeeSalaryService],
})
export class AdminModule {}
