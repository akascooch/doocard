import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('revenue')
  async getRevenue() {
    return this.dashboardService.getRevenue();
  }

  @Get('popular-services')
  async getPopularServices() {
    return this.dashboardService.getPopularServices();
  }

  @Get('summary')
  async getSummary() {
    return this.dashboardService.getSummary();
  }

  @Get('appointments-by-day')
  async getAppointmentsByDay() {
    return this.dashboardService.getAppointmentsByDay();
  }
}
