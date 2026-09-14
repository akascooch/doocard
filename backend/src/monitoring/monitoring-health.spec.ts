import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

describe('monitoring-health (v2.0.7)', () => {
  const prisma = { $queryRaw: jest.fn() };
  const config = { get: jest.fn() };
  const service = new MonitoringService(prisma as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
  });

  it('protects health and metrics with JWT + PermissionGuard and ADMIN role', () => {
    const guards = Reflect.getMetadata('__guards__', MonitoringController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionGuard]));
    expect(Reflect.getMetadata('roles', MonitoringController.prototype.getSystemHealth)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata('roles', MonitoringController.prototype.getMetrics)).toEqual(['ADMIN']);
  });

  it.each(['EMPLOYEE', 'CUSTOMER', 'ACCOUNTANT', 'SERVICE'] as const)(
    'PermissionGuard denies %s on getSystemHealth',
    (role) => {
      const guard = new PermissionGuard(new Reflector());
      const context = {
        getHandler: () => MonitoringController.prototype.getSystemHealth,
        getClass: () => MonitoringController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 1, role } }),
        }),
      } as unknown as ExecutionContext;
      expect(guard.canActivate(context)).toBe(false);
    },
  );

  it('PermissionGuard allows ADMIN on getSystemHealth', () => {
    const guard = new PermissionGuard(new Reflector());
    const context = {
      getHandler: () => MonitoringController.prototype.getSystemHealth,
      getClass: () => MonitoringController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1, role: 'ADMIN' } }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns the documented health payload shape', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    service.recordClientError();
    const health = await service.getSystemHealth();

    expect(health).toEqual(
      expect.objectContaining({
        status: 'healthy',
        timezone: 'Asia/Tehran',
        clientErrorsLast24h: 1,
        clientErrorsScope: 'process-local',
      }),
    );
    expect(typeof health.timestamp).toBe('string');
    expect(health.services.database).toEqual(expect.objectContaining({ status: 'ok', latencyMs: expect.any(Number) }));
    expect(health.services.redis).toEqual({ status: 'not_configured' });
    expect(health.services.cache).toEqual(
      expect.objectContaining({ status: 'memory' }),
    );
    expect(health.system.memory).toEqual(
      expect.objectContaining({
        totalMb: expect.any(Number),
        freeMb: expect.any(Number),
        usedMb: expect.any(Number),
        processRssMb: expect.any(Number),
        processHeapUsedMb: expect.any(Number),
      }),
    );
    expect(health.system.cpu).toEqual(
      expect.objectContaining({
        cores: expect.any(Number),
        percentSinceBoot: expect.any(Number),
        processUserMs: expect.any(Number),
        processSystemMs: expect.any(Number),
      }),
    );
    expect(health.system.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(health.system.nodeVersion).toMatch(/^v/);
    expect(health.system.platform).toBeTruthy();
  });

  it('getMetrics payload includes request/error counters and formatted uptime', () => {
    service.incrementRequests();
    service.incrementRequests();
    service.incrementErrors();
    const metrics = service.getMetrics();
    expect(metrics).toEqual(
      expect.objectContaining({
        requests: 2,
        errors: 1,
        errorRate: '50.00%',
      }),
    );
    expect(typeof metrics.uptime).toBe('string');
    expect(typeof metrics.startTime).toBe('string');
    expect(typeof metrics.lastReset).toBe('string');
  });
});
