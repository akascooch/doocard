import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaTestService } from '../../tests/prisma-test.service';
import { HealthModule } from './health.module';
import { PrismaService } from '../prisma/prisma.service';
import request from 'supertest';

describe('Health Integration Tests (aligned to Terminus)', () => {
  let app: INestApplication;
  let prismaTestService: PrismaTestService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useClass(PrismaTestService)
      .compile();

    app = moduleFixture.createNestApplication();
		prismaTestService = moduleFixture.get<PrismaService>(PrismaService) as unknown as PrismaTestService;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prismaTestService.resetDatabase();
  });

  describe('GET /health', () => {
		it('should return ok with database up (Terminus format)', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

			// Terminus standard payload: { status, info, error, details }
      expect(response.body).toHaveProperty('status');
			expect(['ok', 'error']).toContain(response.body.status);
			expect(response.body).toHaveProperty('info');
			expect(response.body.info).toHaveProperty('database');
			expect(response.body.info.database).toHaveProperty('status', 'up');
			expect(response.body).toHaveProperty('details');
			expect(response.body.details).toHaveProperty('database');
    });
  });
});
