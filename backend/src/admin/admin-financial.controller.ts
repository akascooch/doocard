import { BadRequestException, Controller, Get, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { FinancialReportsAccessGuard } from '../common/guards/financial-reports-access.guard';
import { AdminFinancialService, ExpenseDrillBucket } from './admin-financial.service';
import { FinancialReportsAccessService } from '../settings/financial-reports-access.service';
import { VerifyFinancialAccessDto } from '../settings/dto/verify-financial-access.dto';
import { parseJalaliYearQuery } from '../common/utils/date-utils';

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
    return this.adminFinancialService.getYearlyReport(parseJalaliYearQuery(year));
  }

  @Get('product-sales-monthly')
  @Roles('ADMIN')
  @UseGuards(FinancialReportsAccessGuard)
  async getProductSalesMonthly(@Query('year') year?: string) {
    return this.adminFinancialService.getMonthlyProductSales(parseJalaliYearQuery(year));
  }

  @Get('expenses')
  @Roles('ADMIN')
  @UseGuards(FinancialReportsAccessGuard)
  async getExpenses(
    @Query('fromJalali') fromJalali?: string,
    @Query('toJalali') toJalali?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('bucket') bucket?: string,
    @Query('categoryId') categoryId?: string,
    @Query('createdBy') createdBy?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const allowed: ExpenseDrillBucket[] = ['cheque', 'uncategorized', 'category'];
    if (!bucket || !allowed.includes(bucket as ExpenseDrillBucket)) {
      throw new BadRequestException('bucket must be cheque, uncategorized, or category');
    }
    return this.adminFinancialService.getExpenseDrilldown({
      fromJalali,
      toJalali,
      year: year ? parseInt(year, 10) : undefined,
      month: month ? parseInt(month, 10) : undefined,
      bucket: bucket as ExpenseDrillBucket,
      categoryId: categoryId ? parseInt(categoryId, 10) : undefined,
      createdBy: createdBy ? parseInt(createdBy, 10) : undefined,
      cursor: cursor ? parseInt(cursor, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
}
