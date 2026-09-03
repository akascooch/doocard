import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { EmployeeSalaryRequestController } from './employee-salary-request.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [PrismaModule, AdminModule],
  controllers: [EmployeesController, EmployeeSalaryRequestController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}