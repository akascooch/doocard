import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('ADMIN', 'EMPLOYEE')
  async getSummary(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getSummary(currentUser);
  }

  @Get('stats')
  @Roles('ADMIN', 'EMPLOYEE')
  async getStats(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: any
  ) {
    const currentUser = req.user;
    return this.dashboardService.getStats(new Date(startDate), new Date(endDate), currentUser);
  }

  @Get('appointment-stats')
  @Roles('ADMIN', 'EMPLOYEE')
  async getAppointmentStats(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getAppointmentStats(currentUser);
  }

  @Get('revenue')
  @Roles('ADMIN', 'EMPLOYEE')
  async getRevenue(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getRevenue(currentUser);
  }

  @Get('popular-services')
  @Roles('ADMIN', 'EMPLOYEE')
  async getPopularServices(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getPopularServices(currentUser);
  }

  @Get('appointments-by-day')
  @Roles('ADMIN', 'EMPLOYEE')
  async getAppointmentsByDay(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getAppointmentsByDay(currentUser);
  }

  @Get('customer-appointments-chart')
  @Roles('ADMIN', 'EMPLOYEE')
  async getCustomerAppointmentsChart(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getCustomerAppointmentsChart(currentUser);
  }

  @Get('admin-stats')
  @Roles('ADMIN')
  async getAdminStats(@Req() req: any) {
    return this.dashboardService.getAdminStats();
  }

  @Get('employee-stats')
  @Roles('EMPLOYEE')
  async getEmployeeStats(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getEmployeeStats(currentUser);
  }

  @Get('employee-today-appointments')
  @Roles('EMPLOYEE')
  async getEmployeeTodayAppointments(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getEmployeeTodayAppointments(currentUser);
  }

  @Get('customer-stats')
  @Roles('CUSTOMER')
  async getCustomerStats(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getCustomerStats(currentUser);
  }

  @Get('customer-upcoming-appointments')
  @Roles('CUSTOMER')
  async getCustomerUpcomingAppointments(@Req() req: any) {
    const currentUser = req.user;
    return this.dashboardService.getCustomerUpcomingAppointments(currentUser);
  }

  @Get('financial-stats')
  @Roles('ADMIN')
  async getFinancialStats(@Req() req: any) {
    return this.dashboardService.getFinancialStats();
  }
}
