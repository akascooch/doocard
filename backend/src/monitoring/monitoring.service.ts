import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as os from 'os';
import { PrismaService } from '../prisma/prisma.service';

const CLIENT_ERROR_WINDOW_MS = 24 * 60 * 60 * 1000;
const CLIENT_ERROR_CAP = 2000;

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private metrics = {
    requests: 0,
    errors: 0,
    startTime: Date.now(),
    lastReset: Date.now(),
  };
  /** Process-local timestamps only — no payloads, no tokens. Lost on restart. */
  private clientErrorAt: number[] = [];

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    void this.config;
  }

  incrementRequests(): void {
    this.metrics.requests++;
  }

  incrementErrors(): void {
    this.metrics.errors++;
  }

  recordClientError(): void {
    const now = Date.now();
    this.clientErrorAt.push(now);
    this.pruneClientErrors(now);
  }

  clientErrorsLast24h(now = Date.now()): number {
    this.pruneClientErrors(now);
    return this.clientErrorAt.length;
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
    const [database, redis] = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
    ]);
    const system = this.getSystemResources();
    const clientErrorsLast24h = this.clientErrorsLast24h();
    const overall =
      database.status === 'ok' ? (redis.status === 'down' ? 'degraded' : 'healthy') : 'unhealthy';

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      timezone: 'Asia/Tehran',
      services: {
        database,
        redis,
        cache: { status: 'memory', note: 'AppCacheModule is in-process; Redis is optional' },
      },
      system,
      clientErrorsLast24h,
      clientErrorsScope: 'process-local',
    };
  }

  private pruneClientErrors(now: number): void {
    const cutoff = now - CLIENT_ERROR_WINDOW_MS;
    this.clientErrorAt = this.clientErrorAt.filter((ts) => ts >= cutoff);
    if (this.clientErrorAt.length > CLIENT_ERROR_CAP) {
      this.clientErrorAt = this.clientErrorAt.slice(-CLIENT_ERROR_CAP);
    }
  }

  private async checkDatabaseHealth(): Promise<{
    status: 'ok' | 'down';
    latencyMs: number;
  }> {
    const started = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', latencyMs: Date.now() - started };
    } catch (error) {
      this.logger.error('Database health check failed');
      return { status: 'down', latencyMs: Date.now() - started };
    }
  }

  private async checkRedisHealth(): Promise<{
    status: 'ok' | 'down' | 'not_configured';
    latencyMs?: number;
  }> {
    const url = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST;
    if (!url && !host) {
      return { status: 'not_configured' };
    }
    const started = Date.now();
    let client: { connect: () => Promise<unknown>; ping: () => Promise<unknown>; quit: () => Promise<unknown> } | null =
      null;
    try {
      // ioredis is already a Bull/SMS transitive dependency; short-lived ping only.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RedisCtor = require('ioredis');
      client = url
        ? new RedisCtor(url, {
            connectTimeout: 1500,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            enableOfflineQueue: false,
          })
        : new RedisCtor({
            host,
            port: Number(process.env.REDIS_PORT || 6379),
            connectTimeout: 1500,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            enableOfflineQueue: false,
          });
      await client.connect();
      await client.ping();
      await client.quit();
      return { status: 'ok', latencyMs: Date.now() - started };
    } catch {
      if (client) {
        try {
          await client.quit();
        } catch {
          /* ignore */
        }
      }
      return { status: 'down', latencyMs: Date.now() - started };
    }
  }

  private getSystemResources() {
    const usage = process.memoryUsage();
    const totalBytes = os.totalmem();
    const freeBytes = os.freemem();
    const usedBytes = totalBytes - freeBytes;
    const cpus = os.cpus() ?? [];
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
    }
    const cpuPercentSinceBoot = total > 0 ? Math.round((1 - idle / total) * 1000) / 10 : 0;
    const cpuUsage = process.cpuUsage();

    return {
      memory: {
        totalMb: bytesToMb(totalBytes),
        freeMb: bytesToMb(freeBytes),
        usedMb: bytesToMb(usedBytes),
        processRssMb: bytesToMb(usage.rss),
        processHeapUsedMb: bytesToMb(usage.heapUsed),
      },
      cpu: {
        cores: cpus.length,
        percentSinceBoot: cpuPercentSinceBoot,
        processUserMs: Math.round(cpuUsage.user / 1000),
        processSystemMs: Math.round(cpuUsage.system / 1000),
      },
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
    };
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

function bytesToMb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10;
}
