import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { SalaryService, SalaryCalculationParams } from './salary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums';

@Controller('salary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryController {
  constructor(private readonly salaryService: SalaryService) {}

  /**
   * محاسبه حقوق کارمند برای بازه زمانی مشخص
   */
  @Post('calculate')
  @Roles(Role.ADMIN)
  async calculateSalary(@Body() params: SalaryCalculationParams) {
    return this.salaryService.calculateSalary(params);
  }

  /**
   * ایجاد درخواست حقوق
   */
  @Post()
  @Roles(Role.ADMIN)
  async createSalaryRequest(@Body() data: {
    employeeId: number;
    periodStart: Date;
    periodEnd: Date;
    amount: number;
  }) {
    return this.salaryService.createSalaryRequest(data);
  }

  /**
   * پرداخت حقوق
   */
  @Post('pay/:salaryId')
  @Roles(Role.ADMIN)
  async paySalary(@Param('salaryId') salaryId: string) {
    return this.salaryService.paySalary(parseInt(salaryId));
  }

  /**
   * دریافت لیست حقوق‌های پرداخت‌نشده
   */
  @Get('unpaid')
  @Roles(Role.ADMIN)
  async getUnpaidSalaries() {
    return this.salaryService.getUnpaidSalaries();
  }

  /**
   * دریافت لیست حقوق‌های پرداخت‌شده
   */
  @Get('paid')
  @Roles(Role.ADMIN)
  async getPaidSalaries() {
    return this.salaryService.getPaidSalaries();
  }

  /**
   * دریافت تاریخچه حقوق کارمند
   */
  @Get('employee/:employeeId')
  @Roles(Role.ADMIN, Role.EMPLOYEE)
  async getEmployeeSalaryHistory(@Param('employeeId') employeeId: string) {
    return this.salaryService.getEmployeeSalaryHistory(parseInt(employeeId));
  }

  /**
   * دریافت آمار حقوق
   */
  @Get('stats')
  @Roles(Role.ADMIN)
  async getSalaryStats() {
    return this.salaryService.getSalaryStats();
  }
}