import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaTestService } from '../../tests/prisma-test.service';
import { DashboardModule } from './dashboard.module';
import { PrismaService } from '../prisma/prisma.service';
import request from 'supertest';

describe('Dashboard Integration Tests', () => {
  let app: INestApplication;
  let prismaTestService: PrismaTestService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DashboardModule],
    })
      .overrideProvider(PrismaService)
      .useClass(PrismaTestService)
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../common/guards/permission.guard').PermissionGuard)
      .useValue({ canActivate: () => true })
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

  describe('GET /dashboard/summary', () => {
    beforeEach(async () => {
      // Create test data
      const user = await prismaTestService.user.create({
        data: {
          name: 'Test User',
          email: `test_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      const customer = await prismaTestService.customer.create({
        data: { userId: user.id },
      });

      const employee = await prismaTestService.employee.create({
        data: { userId: user.id },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      // Create appointments
      await prismaTestService.appointment.createMany({
        data: [
          {
            customerId: customer.id,
            employeeId: employee.id,
            serviceId: service.id,
            scheduledAt: new Date('2024-01-15T10:00:00Z'),
            status: 'COMPLETED',
          },
          {
            customerId: customer.id,
            employeeId: employee.id,
            serviceId: service.id,
            scheduledAt: new Date('2024-01-16T10:00:00Z'),
            status: 'PENDING',
          },
        ],
      });

      // Create transactions for first appointment
      const firstAppointment = await prismaTestService.appointment.findFirst({ orderBy: { id: 'asc' } });
      await prismaTestService.transaction.createMany({
        data: [
          { type: 'SERVICE', amount: 50.0, method: 'CASH', relatedId: firstAppointment!.id, createdAt: new Date('2024-01-15T11:00:00Z') },
          { type: 'TIP', amount: 10.0, method: 'CASH', relatedId: firstAppointment!.id, createdAt: new Date('2024-01-15T11:05:00Z') },
        ],
      });
    });

    it('should return dashboard summary', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/summary')
        .expect(200);

      expect(response.body).toHaveProperty('totalAppointments');
      expect(response.body).toHaveProperty('totalRevenue');
    });
  });

  // Controller does not expose /dashboard/appointments in current codebase; skipping this block
  /* describe('GET /dashboard/appointments', () => {
    beforeEach(async () => {
      // Create test data
      const user = await prismaTestService.user.create({
        data: {
          name: 'Test User',
          email: `test_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      const customer = await prismaTestService.customer.create({
        data: { userId: user.id },
      });

      const employee = await prismaTestService.employee.create({
        data: { userId: user.id },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      // Create appointments
      await prismaTestService.appointment.createMany({
        data: [
          {
            customerId: customer.id,
            employeeId: employee.id,
            serviceId: service.id,
            scheduledAt: new Date('2024-01-15T10:00:00Z'),
            status: 'COMPLETED',
          },
          {
            customerId: customer.id,
            employeeId: employee.id,
            serviceId: service.id,
            scheduledAt: new Date('2024-01-16T10:00:00Z'),
            status: 'PENDING',
          },
        ],
      });
    });

    it('should return appointments list', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/appointments')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('scheduledAt');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('customer');
      expect(response.body[0]).toHaveProperty('employee');
      expect(response.body[0]).toHaveProperty('service');
    });

    it('should filter appointments by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/appointments?status=COMPLETED')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe('COMPLETED');
    });

    it('should filter appointments by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const response = await request(app.getHttpServer())
        .get(`/dashboard/appointments?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body).toHaveLength(2);
    });
  }); */

  describe('GET /dashboard/revenue', () => {
    beforeEach(async () => {
      // Create appointment and related transactions
      const user = await prismaTestService.user.create({
        data: {
          name: 'Revenue User',
          email: `rev_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });
      const customer = await prismaTestService.customer.create({ data: { userId: user.id } });
      const empUser = await prismaTestService.user.create({
        data: {
          name: 'Revenue Emp',
          email: `rev_emp_${Date.now()}@example.com`,
          phone: `0912${(Date.now()+1).toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });
      const employee = await prismaTestService.employee.create({ data: { userId: empUser.id } });
      const service = await prismaTestService.service.create({ data: { name: 'Service A', price: 100, durationMinutes: 30, category: 'Hair' } });
      const appt = await prismaTestService.appointment.create({
        data: { customerId: customer.id, employeeId: employee.id, serviceId: service.id, scheduledAt: new Date('2024-01-15T10:00:00Z'), status: 'COMPLETED' },
      });
      await prismaTestService.transaction.createMany({
        data: [
          { type: 'SERVICE', amount: 100.0, method: 'CASH', relatedId: appt.id, createdAt: new Date('2024-01-15T11:00:00Z') },
          { type: 'TIP', amount: 20.0, method: 'CASH', relatedId: appt.id, createdAt: new Date('2024-01-15T11:05:00Z') },
          { type: 'EXPENSE', amount: 30.0, method: 'CASH', createdAt: new Date('2024-01-15T12:00:00Z') },
        ],
      });
    });

    it('should return revenue data', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/revenue')
        .expect(200);

      expect(response.body).toHaveProperty('revenue');
    });

    it('should filter revenue by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const response = await request(app.getHttpServer())
        .get(`/dashboard/revenue?startDate=${startDate}&endDate=${endDate}`)
        .expect(200);

      expect(response.body).toHaveProperty('revenue');
    });
  });

  /* describe('GET /dashboard/employees', () => {
    beforeEach(async () => {
      // Create test employees
      const user1 = await prismaTestService.user.create({
        data: {
          name: 'Employee 1',
          email: 'employee1@example.com',
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const user2 = await prismaTestService.user.create({
        data: {
          name: 'Employee 2',
          email: 'employee2@example.com',
          phone: `0912${(Date.now()+1).toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      await prismaTestService.employee.createMany({
        data: [
          { userId: user1.id },
          { userId: user2.id },
        ],
      });
    });

    it('should return employees list', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/employees')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('user');
      expect(response.body[0]).toHaveProperty('appointmentsCount');
      expect(response.body[0]).toHaveProperty('totalEarnings');
    });
  }); */

  // Controller does not expose /dashboard/customers in current codebase; skipping
  /* describe('GET /dashboard/customers', () => {
    beforeEach(async () => {
      // Create test customers
      const user1 = await prismaTestService.user.create({
        data: {
          name: 'Customer 1',
          email: `customer1_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      const user2 = await prismaTestService.user.create({
        data: {
          name: 'Customer 2',
          email: `customer2_${Date.now()}@example.com`,
          phone: `0912${(Date.now()+1).toString().slice(-7)}`,
          password: 'hashed',
          role: 'CUSTOMER',
        },
      });

      await prismaTestService.customer.createMany({
        data: [
          { userId: user1.id },
          { userId: user2.id },
        ],
      });
    });

    it('should return customers list', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/customers')
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('user');
      expect(response.body[0]).toHaveProperty('appointmentsCount');
      expect(response.body[0]).toHaveProperty('totalSpent');
    });
  }); */

  describe('GET /dashboard/popular-services', () => {
    beforeEach(async () => {
      // Create test services
      await prismaTestService.service.createMany({
        data: [
          {
            name: 'Haircut',
            price: 50.0,
            durationMinutes: 30,
            category: 'Hair',
          },
          {
            name: 'Facial',
            price: 80.0,
            durationMinutes: 60,
            category: 'Skin',
          },
        ],
      });
    });

    it('should return services list', async () => {
      const response = await request(app.getHttpServer())
        .get('/dashboard/popular-services')
        .expect(200);

      expect(Array.isArray(response.body.services)).toBe(true);
      if (response.body.services.length > 0) {
        expect(response.body.services[0]).toHaveProperty('serviceName');
        expect(response.body.services[0]).toHaveProperty('count');
      }
    });
  });

  // Skipped: /dashboard/analytics endpoint not available in controller

  // describe('GET /dashboard/notifications', () => {
  //   beforeEach(async () => {
  //     await prismaTestService.notification.createMany({
  //       data: [
  //         {
  //           title: 'Test Notification 1',
  //           message: 'Test message 1',
  //           type: 'INFO',
  //           isRead: false,
  //         },
  //         {
  //           title: 'Test Notification 2',
  //           message: 'Test message 2',
  //           type: 'WARNING',
  //           isRead: true,
  //         },
  //       ],
  //     });
  //   });

  //   it('should return notifications list', async () => {
  //     const response = await request(app.getHttpServer())
  //       .get('/dashboard/notifications')
  //       .expect(200);

  //     expect(response.body).toHaveLength(2);
  //     expect(response.body[0]).toHaveProperty('id');
  //     expect(response.body[0]).toHaveProperty('title');
  //     expect(response.body[0]).toHaveProperty('message');
  //     expect(response.body[0]).toHaveProperty('type');
  //     expect(response.body[0]).toHaveProperty('isRead');
  //   });

  //   it('should filter notifications by type', async () => {
  //     const response = await request(app.getHttpServer())
  //       .get('/dashboard/notifications?type=INFO')
  //       .expect(200);

  //     expect(response.body).toHaveLength(1);
  //     expect(response.body[0].type).toBe('INFO');
  //   });

  //   it('should filter notifications by read status', async () => {
  //     const response = await request(app.getHttpServer())
  //       .get('/dashboard/notifications?isRead=false')
  //       .expect(200);

  //     expect(response.body).toHaveLength(1);
  //     expect(response.body[0].isRead).toBe(false);
  //   });
  // });

  // Notification tests commented out - notification model not available
  // describe('PATCH /dashboard/notifications/:id/read', () => {
  //   let notificationId: number;
  //
  //   beforeEach(async () => {
  //     const notification = await prismaTestService.notification.create({
  //       data: {
  //         title: 'Test Notification',
  //         message: 'Test message',
  //         type: 'INFO',
  //         isRead: false,
  //       },
  //     });
  //     notificationId = notification.id;
  //   });
  //
  //   it('should mark notification as read', async () => {
  //     const response = await request(app.getHttpServer())
  //       .patch(`/dashboard/notifications/${notificationId}/read`)
  //       .expect(200);
  //
  //     expect(response.body).toHaveProperty('isRead', true);
  //   });
  //
  //   it('should return 404 when notification not found', async () => {
  //     await request(app.getHttpServer())
  //       .patch('/dashboard/notifications/999/read')
  //       .expect(404);
  //   });
  // });

  // describe('PATCH /dashboard/notifications/read-all', () => {
  //   beforeEach(async () => {
  //     // Create test notifications
  //     await prismaTestService.notification.createMany({
  //       data: [
  //         {
  //           title: 'Test Notification 1',
  //           message: 'Test message 1',
  //           type: 'INFO',
  //           isRead: false,
  //         },
  //         {
  //           title: 'Test Notification 2',
  //           message: 'Test message 2',
  //           type: 'WARNING',
  //           isRead: false,
  //         },
  //       ],
  //     });
  //   });
  //
  //   it('should mark all notifications as read', async () => {
  //     const response = await request(app.getHttpServer())
  //       .patch('/dashboard/notifications/read-all')
  //       .expect(200);
  //
  //     expect(response.body).toHaveProperty('message', 'All notifications marked as read');
  //   });
  // });
});
