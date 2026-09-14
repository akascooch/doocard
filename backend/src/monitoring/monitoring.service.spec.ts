import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  const prisma = { $queryRaw: jest.fn() };
  const config = { get: jest.fn() };
  const service = new MonitoringService(prisma as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
  });

  it('counts process-local client errors within 24h without storing payloads', () => {
    expect(service.clientErrorsLast24h()).toBe(0);
    service.recordClientError();
    service.recordClientError();
    expect(service.clientErrorsLast24h()).toBe(2);
  });

  it('reports postgres ok and redis not_configured when REDIS_* is unset', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const health = await service.getSystemHealth();
    expect(health.services.database.status).toBe('ok');
    expect(health.services.redis.status).toBe('not_configured');
    expect(health.system.memory.totalMb).toBeGreaterThan(0);
    expect(health.system.cpu.cores).toBeGreaterThan(0);
    expect(health.status).toBe('healthy');
  });

  it('marks overall unhealthy when postgres is down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('db down'));
    const health = await service.getSystemHealth();
    expect(health.services.database.status).toBe('down');
    expect(health.status).toBe('unhealthy');
  });
});
