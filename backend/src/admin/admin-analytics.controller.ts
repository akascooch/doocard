import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AdminAnalyticsService } from './admin-analytics.service';
import { parseJalaliYearQuery } from '../common/utils/date-utils';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get('top-customers')
  @Roles('ADMIN')
  getTopCustomers(@Query('year') year?: string, @Query('limit') limit?: string) {
    const take = limit ? parseInt(limit, 10) : 10;
    const safeYear = parseJalaliYearQuery(year);
    const safeLimit = Number.isFinite(take) ? take : 10;
    return this.analytics.getTopCustomers({ year: safeYear, limit: safeLimit });
  }
}
