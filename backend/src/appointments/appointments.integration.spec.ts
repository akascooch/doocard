import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaTestService } from '../../tests/prisma-test.service';
import { AppointmentsModule } from './appointments.module';
import { PrismaService } from '../prisma/prisma.service';
import request from 'supertest';

describe('Appointments Integration Tests', () => {
  let app: INestApplication;
  let prismaTestService: PrismaTestService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppointmentsModule],
    })
      .overrideProvider(PrismaService)
      .useClass(PrismaTestService)
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../common/guards/permission.guard').PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    // Get the overridden PrismaService instance which is PrismaTestService
    prismaTestService = moduleFixture.get<PrismaService>(PrismaService) as unknown as PrismaTestService;
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prismaTestService.resetDatabase();
  });

  describe('POST /appointments', () => {
    let customerId: number;
    let employeeId: number;
    let serviceId: number;

    beforeEach(async () => {
      // Create test data
      const user1 = await prismaTestService.user.create({
        data: {
          name: 'John Doe',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      const user2 = await prismaTestService.user.create({
        data: {
          name: 'Jane Smith',
          email: `jane_${Date.now()}@example.com`,
          phone: `0912${(Date.now()+1).toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const customer = await prismaTestService.customer.create({
        data: { userId: user1.id },
      });

      const employee = await prismaTestService.employee.create({
        data: { userId: user2.id, specialty: 'Hair Stylist' },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      customerId = customer.id;
      employeeId = employee.id;
      serviceId = service.id;
    });

    it('should create appointment successfully', async () => {
      const appointmentData = {
        customerId,
        employeeId,
        serviceId,
        scheduledAt: '2024-01-15T10:00:00Z',
        status: 'PENDING',
      };

      const response = await request(app.getHttpServer())
        .post('/appointments')
        .send(appointmentData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('customerId', customerId);
      expect(response.body).toHaveProperty('employeeId', employeeId);
      expect(response.body).toHaveProperty('serviceId', serviceId);
      expect(response.body).toHaveProperty('status', 'PENDING');
      expect(response.body).toHaveProperty('totalAmount', 50.0);
      expect(response.body).toHaveProperty('customerName', 'John Doe');
      expect(response.body).toHaveProperty('employeeName', 'Jane Smith');
      expect(response.body).toHaveProperty('serviceName', 'Haircut');

      // Verify appointment was created in database
      const appointment = await prismaTestService.appointment.findUnique({
        where: { id: response.body.id },
      });
      expect(appointment).toBeTruthy();
    });

    it('should return 404 when customer not found', async () => {
      const appointmentData = {
        customerId: 999,
        employeeId,
        serviceId,
        scheduledAt: '2024-01-15T10:00:00Z',
        status: 'PENDING',
      };

      await request(app.getHttpServer())
        .post('/appointments')
        .send(appointmentData)
        .expect(404);
    });

    it('should return 404 when employee not found', async () => {
      const appointmentData = {
        customerId,
        employeeId: 999,
        serviceId,
        scheduledAt: '2024-01-15T10:00:00Z',
        status: 'PENDING',
      };

      await request(app.getHttpServer())
        .post('/appointments')
        .send(appointmentData)
        .expect(404);
    });

    it('should return 404 when service not found', async () => {
      const appointmentData = {
        customerId,
        employeeId,
        serviceId: 999,
        scheduledAt: '2024-01-15T10:00:00Z',
        status: 'PENDING',
      };

      await request(app.getHttpServer())
        .post('/appointments')
        .send(appointmentData)
        .expect(404);
    });
  });

  describe('GET /appointments', () => {
    beforeEach(async () => {
      // Create test appointments
      const user1 = await prismaTestService.user.create({
        data: {
          name: 'John Doe',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${(Date.now()+2).toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      const user2 = await prismaTestService.user.create({
        data: {
          name: 'Jane Smith',
          email: `jane_${Date.now()}@example.com`,
          phone: `09987654321`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const customer = await prismaTestService.customer.create({
        data: { userId: user1.id },
      });

      const employee = await prismaTestService.employee.create({
        data: { userId: user2.id, specialty: 'Hair Stylist' },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      await prismaTestService.appointment.create({
        data: {
          customerId: customer.id,
          employeeId: employee.id,
          serviceId: service.id,
          scheduledAt: new Date('2024-01-15T10:00:00Z'),
          status: 'PENDING',
        },
      });
    });

    it('should return all appointments', async () => {
      const response = await request(app.getHttpServer())
        .get('/appointments')
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('customerName');
      expect(response.body[0]).toHaveProperty('employeeName');
      expect(response.body[0]).toHaveProperty('serviceName');
    });
  });

  describe('GET /appointments/:id', () => {
    let appointmentId: number;

    beforeEach(async () => {
      const user1 = await prismaTestService.user.create({
        data: {
          name: 'John Doe',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${(Date.now()+3).toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      const user2 = await prismaTestService.user.create({
        data: {
          name: 'Jane Smith',
          email: `jane_${Date.now()}@example.com`,
          phone: `09987654321`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const customer = await prismaTestService.customer.create({
        data: { userId: user1.id },
      });

      const employee = await prismaTestService.employee.create({
        data: { userId: user2.id, specialty: 'Hair Stylist' },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      const appointment = await prismaTestService.appointment.create({
        data: {
          customerId: customer.id,
          employeeId: employee.id,
          serviceId: service.id,
          scheduledAt: new Date('2024-01-15T10:00:00Z'),
          status: 'PENDING',
        },
      });

      appointmentId = appointment.id;
    });

    it('should return appointment by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/appointments/${appointmentId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', appointmentId);
      expect(response.body).toHaveProperty('customerName', 'John Doe');
      expect(response.body).toHaveProperty('employeeName', 'Jane Smith');
      expect(response.body).toHaveProperty('serviceName', 'Haircut');
    });

    it('should return 404 when appointment not found', async () => {
      await request(app.getHttpServer())
        .get('/appointments/999')
        .expect(404);
    });
  });

  describe('PATCH /appointments/:id', () => {
    let appointmentId: number;

    beforeEach(async () => {
      const user1 = await prismaTestService.user.create({
        data: {
          name: 'John Doe',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${(Date.now()+3).toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      const user2 = await prismaTestService.user.create({
        data: {
          name: 'Jane Smith',
          email: `jane_${Date.now()}@example.com`,
          phone: `09987654321`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const customer = await prismaTestService.customer.create({
        data: { userId: user1.id },
      });

      const employee = await prismaTestService.employee.create({
        data: { userId: user2.id, specialty: 'Hair Stylist' },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      const appointment = await prismaTestService.appointment.create({
        data: {
          customerId: customer.id,
          employeeId: employee.id,
          serviceId: service.id,
          scheduledAt: new Date('2024-01-15T10:00:00Z'),
          status: 'PENDING',
        },
      });

      appointmentId = appointment.id;
    });

    it('should update appointment successfully', async () => {
      const updateData = {
        status: 'CONFIRMED',
      };

      const response = await request(app.getHttpServer())
        .patch(`/appointments/${appointmentId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'CONFIRMED');
    });

    it('should return 404 when appointment not found', async () => {
      const updateData = {
        status: 'CONFIRMED',
      };

      await request(app.getHttpServer())
        .patch('/appointments/999')
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /appointments/:id', () => {
    let appointmentId: number;

    beforeEach(async () => {
      const user1 = await prismaTestService.user.create({
        data: {
          name: 'John Doe',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${(Date.now()+3).toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      const user2 = await prismaTestService.user.create({
        data: {
          name: 'Jane Smith',
          email: `jane_${Date.now()}@example.com`,
          phone: `09987654321`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const customer = await prismaTestService.customer.create({
        data: { userId: user1.id },
      });

      const employee = await prismaTestService.employee.create({
        data: { userId: user2.id, specialty: 'Hair Stylist' },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      const appointment = await prismaTestService.appointment.create({
        data: {
          customerId: customer.id,
          employeeId: employee.id,
          serviceId: service.id,
          scheduledAt: new Date('2024-01-15T10:00:00Z'),
          status: 'PENDING',
        },
      });

      appointmentId = appointment.id;
    });

    it('should delete appointment successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/appointments/${appointmentId}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Appointment deleted successfully');

      // Verify appointment was deleted from database
      const appointment = await prismaTestService.appointment.findUnique({
        where: { id: appointmentId },
      });
      expect(appointment).toBeNull();
    });

    it('should return 404 when appointment not found', async () => {
      await request(app.getHttpServer())
        .delete('/appointments/999')
        .expect(404);
    });
  });

  describe('GET /appointments/public-services', () => {
    beforeEach(async () => {
      await prismaTestService.service.createMany({
        data: [
          {
            name: 'Haircut',
            price: 50.0,
            durationMinutes: 30,
            category: 'Hair',
          },
          {
            name: 'Beard Trim',
            price: 25.0,
            durationMinutes: 15,
            category: 'Beard',
          },
        ],
      });
    });

    it('should return public services', async () => {
      const response = await request(app.getHttpServer())
        .get('/appointments/public-services')
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('price');
      expect(response.body[0]).not.toHaveProperty('createdAt');
    });
  });
});
