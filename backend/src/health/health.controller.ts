import { Controller, Get, UseGuards } from '@nestjs/common';
import { HealthCheck, HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private prisma: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('database'),
    ]);
  }

  /**
   * Full health check with detailed diagnostics (ADMIN only)
   */
  @Get('full')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Roles('ADMIN')
  @HealthCheck()
  async fullCheck() {
    const result = await this.health.check([
      () => this.prisma.pingCheck('database'),
    ]);

    return {
      ...result,
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: process.memoryUsage(),
    };
  }
}
