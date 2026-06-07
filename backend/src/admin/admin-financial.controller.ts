import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AdminFinancialService } from './admin-financial.service';

@Controller('admin/financial')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminFinancialController {
  constructor(private readonly adminFinancialService: AdminFinancialService) {}

  @Get('yearly-report')
  @Roles('ADMIN')
  async getYearlyReport(@Query('year') year?: string) {
    const jy = year ? parseInt(year, 10) : 1404;
    if (isNaN(jy) || jy < 1300 || jy > 1500) {
      return this.adminFinancialService.getYearlyReport(1404);
    }
    return this.adminFinancialService.getYearlyReport(jy);
  }
}
