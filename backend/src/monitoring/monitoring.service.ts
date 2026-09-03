import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private metrics = {
    requests: 0,
    errors: 0,
    startTime: Date.now(),
    lastReset: Date.now(),
  };

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  incrementRequests(): void {
    this.metrics.requests++;
  }

  incrementErrors(): void {
    this.metrics.errors++;
  }

  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const errorRate = this.metrics.requests > 0 
      ? (this.metrics.errors / this.metrics.requests) * 100 
      : 0;

    return {
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: errorRate.toFixed(2) + '%',
      uptime: this.formatUptime(uptime),
      startTime: new Date(this.metrics.startTime).toISOString(),
      lastReset: new Date(this.metrics.lastReset).toISOString(),
    };
  }

  async getSystemHealth() {
    try {
      // Database health check
      const dbHealth = await this.checkDatabaseHealth();
      
      // System resources
      const systemResources = this.getSystemResources();

      return {
        status: dbHealth ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth,
          cache: true, // Simplified for now
        },
        system: systemResources,
      };
    } catch (error) {
      this.logger.error('Error getting system health:', error);
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return false;
    }
  }

  private getSystemResources() {
    const usage = process.memoryUsage();
    return {
      memory: {
        rss: this.formatBytes(usage.rss),
        heapTotal: this.formatBytes(usage.heapTotal),
        heapUsed: this.formatBytes(usage.heapUsed),
        external: this.formatBytes(usage.external),
      },
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
    };
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  private formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  resetMetrics(): void {
    this.metrics.requests = 0;
    this.metrics.errors = 0;
    this.metrics.lastReset = Date.now();
    this.logger.log('Metrics reset completed');
  }
}
