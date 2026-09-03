import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('revenue')
  @Roles('admin')
  getRevenue() {
    return this.dashboardService.getRevenue();
  }

  @Get('appointments-count')
  @Roles('admin')
  getAppointmentsCount() {
    return this.dashboardService.getAppointmentsCount();
  }

  @Get('popular-services')
  @Roles('admin')
  getPopularServices() {
    return this.dashboardService.getPopularServices();
  }

  @Get('summary')
  @Roles('admin')
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('appointments-by-day')
  @Roles('admin')
  getAppointmentsByDay(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.dashboardService.getAppointmentsByDay(from, to);
  }
}
