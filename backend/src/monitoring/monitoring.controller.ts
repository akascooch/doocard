import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
// import { RolesGuard } from '../../common/guards/roles.guard';
// import { Roles } from '../../common/decorators/roles.decorator';

@Controller('monitoring')
@UseGuards(JwtAuthGuard)
// @Roles('ADMIN')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('metrics')
  getMetrics() {
    return this.monitoringService.getMetrics();
  }

  @Get('health')
  getSystemHealth() {
    return this.monitoringService.getSystemHealth();
  }

  @Post('metrics/reset')
  resetMetrics() {
    this.monitoringService.resetMetrics();
    return { message: 'Metrics reset successfully' };
  }

  @Get('status')
  getStatus() {
    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
