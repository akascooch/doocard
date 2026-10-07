import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaTestService } from '../../tests/prisma-test.service';
import { AuthModule } from './auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';

describe('Auth Integration Tests', () => {
  let app: INestApplication;
  let prismaTestService: PrismaTestService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(PrismaService)
      .useClass(PrismaTestService)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    prismaTestService = moduleFixture.get<PrismaService>(PrismaService) as unknown as PrismaTestService;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prismaTestService.resetDatabase();
  });

  describe('POST /auth/register', () => {
    it('should register a new customer successfully', async () => {
      const registerData = {
        name: 'John Doe',
        email: `john_${Date.now()}@example.com`,
        phone: `0912${Date.now().toString().slice(-7)}`,
        password: 'password123',
        birthdate: '1990-01-01',
        notes: 'Test customer',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'کاربر با موفقیت ثبت‌نام شد');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        name: registerData.name,
        email: registerData.email,
        phone: registerData.phone,
        role: 'CUSTOMER',
      });

      // Verify user was created in database
      const user = await prismaTestService.user.findUnique({
        where: { id: response.body.user.id },
      });
      expect(user).toBeTruthy();
      expect(user.name).toBe(registerData.name);

      // Verify customer profile was created
      const customer = await prismaTestService.customer.findFirst({
        where: { userId: response.body.user.id },
      });
      expect(customer).toBeTruthy();
    });

    it('should reject a privileged role on public register', async () => {
      const registerData = {
        name: 'Jane Smith',
        email: `jane_${Date.now()}@example.com`,
        phone: `0912${(Date.now()+1).toString().slice(-7)}`,
        password: 'password123',
        role: 'EMPLOYEE',
      };

      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(400);
    });

    it('should return 409 when user already exists', async () => {
      const registerData = {
        name: 'John Doe',
        email: `dup_${Date.now()}@example.com`,
        phone: `0912${Date.now().toString().slice(-7)}`,
        password: 'password123',
      };

      // First registration
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(201);

      // Second registration with same data
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(registerData)
        .expect(409);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
        phone: '',
        password: '123',
      };

      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send(invalidData);
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const hashedPassword = await require('bcrypt').hash('password123', 12);
      await prismaTestService.user.create({
        data: {
          name: 'Test User',
          email: `test_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: hashedPassword,
          role: 'CUSTOMER',
        },
      });
    });

    it('should login with email successfully', async () => {
      const user = await prismaTestService.user.findFirst();
      const loginData = {
        identifier: user.email,
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect([200, 201]);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(user.email);
    });

    it('should login with phone number successfully', async () => {
      const user = await prismaTestService.user.findFirst();
      const loginData = {
        identifier: user.phone,
        password: 'password123',
      };

      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect([200, 201]);

      expect(response.body).toHaveProperty('access_token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.phone).toBe(user.phone);
    });

    it('should return 401 with invalid credentials', async () => {
      const loginData = {
        identifier: 'test@example.com',
        password: 'wrongpassword',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should return 401 with non-existent user', async () => {
      const loginData = {
        identifier: 'nonexistent@example.com',
        password: 'password123',
      };

      await request(app.getHttpServer())
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });
  });
});
