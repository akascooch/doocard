import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckError } from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { PrismaService } from '../prisma/prisma.service';

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator;
  let prismaService: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaHealthIndicator,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    indicator = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('pingCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      const key = 'database';
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await indicator.pingCheck(key);

      expect(result).toEqual({
        [key]: {
          status: 'up',
        },
      });
      expect(mockPrismaService.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
    });

    it('should throw HealthCheckError when database is not accessible', async () => {
      const key = 'database';
      const error = new Error('Database connection failed');
      mockPrismaService.$queryRaw.mockRejectedValue(error);

      await expect(indicator.pingCheck(key)).rejects.toThrow(HealthCheckError);
    });

    it('should include error details in HealthCheckError', async () => {
      const key = 'database';
      const error = new Error('Database connection failed');
      mockPrismaService.$queryRaw.mockRejectedValue(error);

      try {
        await indicator.pingCheck(key);
      } catch (err) {
        expect(err).toBeInstanceOf(HealthCheckError);
        expect(err.message).toBe('Prisma check failed');
        expect(err.causes).toEqual({
          [key]: {
            status: 'down',
          },
        });
      }
    });
  });

  describe('getStatus', () => {
    it('should return healthy status', () => {
      const key = 'test';
      const result = indicator['getStatus'](key, true);

      expect(result).toEqual({
        [key]: {
          status: 'up',
        },
      });
    });

    it('should return unhealthy status', () => {
      const key = 'test';
      const result = indicator['getStatus'](key, false);

      expect(result).toEqual({
        [key]: {
          status: 'down',
        },
      });
    });
  });
});
