import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AdminAnalyticsController {
  constructor(private readonly analytics: AdminAnalyticsService) {}

  @Get('top-customers')
  @Roles('ADMIN')
  getTopCustomers(@Query('year') year?: string, @Query('limit') limit?: string) {
    const jy = year ? parseInt(year, 10) : 1404;
    const take = limit ? parseInt(limit, 10) : 10;
    const safeYear = Number.isFinite(jy) && jy >= 1300 && jy <= 1500 ? jy : 1404;
    const safeLimit = Number.isFinite(take) ? take : 10;
    return this.analytics.getTopCustomers({ year: safeYear, limit: safeLimit });
  }
}
