import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { PermissionGuard } from '../common/guards/permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { SmsAdminController } from '../sms/sms-admin.controller';
import { SmsNotificationPolicyService } from '../sms/sms-notification-policy.service';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SmsTemplateService } from '../sms/sms-template.service';

const UNIT_TEST_JWT_SECRET = 'unit-test-only-jwt-secret-32chars';

describe('import and SMS admin authorization', () => {
  let app: INestApplication;
  const jwt = new JwtService({ secret: UNIT_TEST_JWT_SECRET });
  const getJobForActor = jest.fn().mockResolvedValue({ id: 7, userId: 42, status: 'PENDING' });
  const findMany = jest.fn().mockResolvedValue([]);

  const importRoutes: Array<{ method: 'get' | 'post'; url: string }> = [
    { method: 'get', url: '/import/templates/customers' },
    { method: 'post', url: '/import/upload' },
    { method: 'post', url: '/import/commit' },
    { method: 'get', url: '/import/jobs' },
    { method: 'get', url: '/import/jobs/7' },
  ];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
      controllers: [ImportController, SmsAdminController],
      providers: [
        JwtStrategy,
        JwtAuthGuard,
        PermissionGuard,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) =>
              key === 'JWT_SECRET' ? UNIT_TEST_JWT_SECRET : fallback,
          },
        },
        { provide: ImportService, useValue: { getJobForActor, generateCustomersTemplate: jest.fn() } },
        { provide: PrismaService, useValue: { importJob: { findMany } } },
        { provide: SmsNotificationPolicyService, useValue: {} },
        { provide: SmsOutboundService, useValue: {} },
        { provide: SmsTemplateService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function bearer(role: string, sub = 42) {
    return jwt.sign({
      sub,
      role,
      email: 'unit@example.com',
      phone: '09120000000',
    });
  }

  it.each(importRoutes)('returns 401 for unauthenticated $method $url', async ({ method, url }) => {
    const response = await request(app.getHttpServer())[method](url);
    expect(response.status).toBe(401);
  });

  it.each(['CUSTOMER', 'EMPLOYEE', 'SERVICE', 'ACCOUNTANT', 'MANAGER'])(
    'returns 403 for %s on every import route',
    async (role) => {
      const token = bearer(role);
      for (const route of importRoutes) {
        const response = await request(app.getHttpServer())
          [route.method](route.url)
          .set('Authorization', `Bearer ${token}`);
        expect(response.status).toBe(403);
      }
      expect(getJobForActor).not.toHaveBeenCalled();
    },
  );

  it('lets ADMIN through the import authorization path', async () => {
    const token = bearer('ADMIN', 42);
    const jobs = await request(app.getHttpServer())
      .get('/import/jobs')
      .set('Authorization', `Bearer ${token}`);
    expect(jobs.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 42 } }));

    const detail = await request(app.getHttpServer())
      .get('/import/jobs/7')
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(getJobForActor).toHaveBeenCalledWith(7, 42);

    const commit = await request(app.getHttpServer())
      .post('/import/commit')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(commit.status).toBe(400);
  });

  it('returns 401 and 403 for SMS admin and lets ADMIN read status without a secret', async () => {
    const anonymous = await request(app.getHttpServer()).get('/sms/admin/status');
    expect(anonymous.status).toBe(401);

    const customer = await request(app.getHttpServer())
      .post('/sms/admin/send-custom')
      .set('Authorization', `Bearer ${bearer('CUSTOMER')}`)
      .send({ phone: '09120000000', message: 'hi' });
    expect(customer.status).toBe(403);

    const admin = await request(app.getHttpServer())
      .get('/sms/admin/status')
      .set('Authorization', `Bearer ${bearer('ADMIN')}`);
    expect(admin.status).toBe(200);
    expect(admin.body.provider).toBe('faraz');
    expect(admin.body.apiKeyConfigured).toBe(false);
    expect(JSON.stringify(admin.body)).not.toContain(UNIT_TEST_JWT_SECRET);
  });
});
