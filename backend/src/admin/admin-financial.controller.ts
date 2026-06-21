import { Controller, Get, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { FinancialReportsAccessGuard } from '../common/guards/financial-reports-access.guard';
import { AdminFinancialService } from './admin-financial.service';
import { FinancialReportsAccessService } from '../settings/financial-reports-access.service';
import { VerifyFinancialAccessDto } from '../settings/dto/verify-financial-access.dto';

@Controller('admin/financial')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminFinancialController {
  constructor(
    private readonly adminFinancialService: AdminFinancialService,
    private readonly financialReportsAccessService: FinancialReportsAccessService,
  ) {}

  @Post('verify-access')
  @Roles('ADMIN')
  async verifyAccess(@Req() req: any, @Body() dto: VerifyFinancialAccessDto) {
    return this.financialReportsAccessService.verifyAccess(req.user.id, dto.password);
  }

  @Get('yearly-report')
  @Roles('ADMIN')
  @UseGuards(FinancialReportsAccessGuard)
  async getYearlyReport(@Query('year') year?: string) {
    const jy = year ? parseInt(year, 10) : 1404;
    if (isNaN(jy) || jy < 1300 || jy > 1500) {
      return this.adminFinancialService.getYearlyReport(1404);
    }
    return this.adminFinancialService.getYearlyReport(jy);
  }
}
