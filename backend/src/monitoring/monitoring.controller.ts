import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { getAppVersion } from '../common/app-version';

/**
 * Operational internals. PermissionGuard reads @Roles on the handler
 * (not the class), so ADMIN is declared on every method.
 */
@Controller('monitoring')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('metrics')
  @Roles('ADMIN')
  getMetrics() {
    return this.monitoringService.getMetrics();
  }

  @Get('health')
  @Roles('ADMIN')
  getSystemHealth() {
    return this.monitoringService.getSystemHealth();
  }

  @Post('metrics/reset')
  @Roles('ADMIN')
  resetMetrics() {
    this.monitoringService.resetMetrics();
    return { message: 'Metrics reset successfully' };
  }

  @Get('status')
  @Roles('ADMIN')
  getStatus() {
    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
      version: getAppVersion(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
