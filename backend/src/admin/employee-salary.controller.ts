import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { EmployeeSalaryService } from './employee-salary.service';

@Controller('admin/employee-salary')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class EmployeeSalaryController {
  constructor(private readonly employeeSalaryService: EmployeeSalaryService) {}

  @Get('preview')
  @Roles('ADMIN')
  async preview(
    @Query('employeeId') employeeIdStr: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('percentage') percentageStr: string,
  ) {
    const employeeId = parseInt(employeeIdStr || '0', 10);
    if (isNaN(employeeId) || employeeId < 1) {
      throw new BadRequestException('Invalid employeeId');
    }

    const percentage = parseFloat(percentageStr || '0');
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      throw new BadRequestException('Percentage must be between 0 and 100');
    }

    if (!from || !to) {
      throw new BadRequestException('from and to (Jalali dates) are required');
    }

    return this.employeeSalaryService.preview({
      employeeId,
      fromJalali: from,
      toJalali: to,
      percentage,
    });
  }
}
