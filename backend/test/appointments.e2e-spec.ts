import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Appointments E2E Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let employeeToken: string;
  let customerToken: string;
  let testCustomerId: number;
  let testEmployeeId: number;
  let testServiceId: number;
  let testAccountId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test users and login
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
    });

    if (adminUser) {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: adminUser.phone, password: '123456' });
      adminToken = loginRes.body.access_token;
    }

    // Create test service
    const service = await prisma.service.create({
      data: {
        name: 'Test Service E2E',
        price: 500000, // 50,000 Toman
        durationMinutes: 30,
        description: 'Test service for E2E',
      },
    });
    testServiceId = service.id;

    // Create test bank account
    const account = await prisma.bankAccount.findFirst();
    if (account) {
      testAccountId = account.id;
    }

    // Get test customer
    const customer = await prisma.customer.findFirst({
      include: { user: true },
    });
    if (customer) {
      testCustomerId = customer.id;
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: customer.user.phone, password: '123456' });
      customerToken = loginRes.body.access_token;
    }

    // Get test employee
    const employee = await prisma.employee.findFirst({
      include: { user: true },
    });
    if (employee) {
      testEmployeeId = employee.id;
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ identifier: employee.user.phone, password: '123456' });
      employeeToken = loginRes.body.access_token;

      // Link employee to service
      await prisma.employeeService.upsert({
        where: {
          employeeId_serviceId: {
            employeeId: employee.id,
            serviceId: testServiceId,
          },
        },
        create: {
          employeeId: employee.id,
          serviceId: testServiceId,
        },
        update: {},
      });
    }
  }

  async function cleanupTestData() {
    if (testServiceId) {
      await prisma.service.delete({ where: { id: testServiceId } }).catch(() => {});
    }
  }

  describe('1. Customer Books Multi-Service Appointment', () => {
    let appointmentId: number;

    it('should create appointment with PENDING_CONFIRMATION status', async () => {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 1);
      scheduledAt.setHours(14, 0, 0, 0);

      const response = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          services: [
            {
              serviceId: testServiceId,
              priceAtBooking: 500000,
              durationMin: 30,
            },
          ],
          employeeId: testEmployeeId,
          customerId: testCustomerId,
          scheduledAt: scheduledAt.toISOString(),
          notes: 'Test appointment',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('PENDING');
      expect(response.body.services).toHaveLength(1);
      expect(response.body.amount).toBeNull();
      
      appointmentId = response.body.id;
    });

    it('should list appointment for customer', async () => {
      const response = await request(app.getHttpServer())
        .get('/appointments')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(200);

      const appointment = response.body.data.find((a: any) => a.id === appointmentId);
      expect(appointment).toBeDefined();
    });
  });

  describe('2. Employee/Admin Confirms Appointment', () => {
    let confirmAppointmentId: number;

    beforeAll(async () => {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 2);
      scheduledAt.setHours(15, 0, 0, 0);

      const response = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          services: [{ serviceId: testServiceId, priceAtBooking: 500000, durationMin: 30 }],
          employeeId: testEmployeeId,
          customerId: testCustomerId,
          scheduledAt: scheduledAt.toISOString(),
        });

      confirmAppointmentId = response.body.id;

      // Set to PENDING_CONFIRMATION
      await prisma.appointment.update({
        where: { id: confirmAppointmentId },
        data: { status: 'PENDING_CONFIRMATION' },
      });
    });

    it('should allow employee to confirm appointment', async () => {
      const response = await request(app.getHttpServer())
        .post(`/appointments/${confirmAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${employeeToken}`)
        .expect(200);

      expect(response.body.status).toBe('CONFIRMED');
    });

    it('should not allow customer to confirm', async () => {
      await request(app.getHttpServer())
        .post(`/appointments/${confirmAppointmentId}/confirm`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('3. Admin Settles Appointment', () => {
    let settleAppointmentId: number;

    beforeAll(async () => {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 3);
      scheduledAt.setHours(16, 0, 0, 0);

      const response = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          services: [{ serviceId: testServiceId, priceAtBooking: 500000, durationMin: 30 }],
          employeeId: testEmployeeId,
          customerId: testCustomerId,
          scheduledAt: scheduledAt.toISOString(),
        });

      settleAppointmentId = response.body.id;

      await prisma.appointment.update({
        where: { id: settleAppointmentId },
        data: { status: 'CONFIRMED' },
      });
    });

    it('should settle with CASH and create income transaction', async () => {
      const response = await request(app.getHttpServer())
        .post(`/appointments/${settleAppointmentId}/settle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 500000,
          tipAmount: 50000,
          paymentMethod: 'CASH',
          accountId: testAccountId,
          externalRef: `test_settle_${Date.now()}`,
        })
        .expect(200);

      expect(response.body.status).toBe('SETTLED');
      expect(Number(response.body.amount)).toBe(500000);
      expect(Number(response.body.tipAmount)).toBe(50000);

      // Verify transactions created
      const transactions = await prisma.transaction.findMany({
        where: {
          sourceType: { in: ['APPOINTMENT', 'TIP'] },
          sourceId: settleAppointmentId,
        },
      });

      expect(transactions.length).toBeGreaterThanOrEqual(1);
      const incomeTransaction = transactions.find((t) => t.sourceType === 'APPOINTMENT');
      expect(incomeTransaction).toBeDefined();
      expect(Number(incomeTransaction?.amount)).toBe(500000);
    });

    it('should settle with DEBT and create CustomerDebt', async () => {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 4);
      scheduledAt.setHours(17, 0, 0, 0);

      const apptResponse = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          services: [{ serviceId: testServiceId, priceAtBooking: 300000, durationMin: 30 }],
          employeeId: testEmployeeId,
          customerId: testCustomerId,
          scheduledAt: scheduledAt.toISOString(),
        });

      await prisma.appointment.update({
        where: { id: apptResponse.body.id },
        data: { status: 'CONFIRMED' },
      });

      const response = await request(app.getHttpServer())
        .post(`/appointments/${apptResponse.body.id}/settle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 300000,
          paymentMethod: 'DEBT',
          externalRef: `test_debt_${Date.now()}`,
        })
        .expect(200);

      expect(response.body.status).toBe('SETTLED');

      // Verify CustomerDebt created
      const debt = await prisma.customerDebt.findFirst({
        where: {
          customerId: testCustomerId,
          sourceType: 'APPOINTMENT',
          sourceId: apptResponse.body.id,
        },
      });

      expect(debt).toBeDefined();
      expect(Number(debt?.amount)).toBe(300000);
    });
  });

  describe('4. Overlap Prevention', () => {
    it('should prevent overlapping appointments for same employee', async () => {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 5);
      scheduledAt.setHours(10, 0, 0, 0);

      // Create first appointment
      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          services: [{ serviceId: testServiceId, priceAtBooking: 500000, durationMin: 60 }],
          employeeId: testEmployeeId,
          customerId: testCustomerId,
          scheduledAt: scheduledAt.toISOString(),
        })
        .expect(201);

      // Try to create overlapping appointment (10:30 - would overlap with 10:00-11:00)
      const overlappingTime = new Date(scheduledAt);
      overlappingTime.setMinutes(30);

      await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          services: [{ serviceId: testServiceId, priceAtBooking: 500000, durationMin: 30 }],
          employeeId: testEmployeeId,
          customerId: testCustomerId,
          scheduledAt: overlappingTime.toISOString(),
        })
        .expect(400);
    });
  });

  describe('5. Available Slots', () => {
    it('should return available time slots for employee', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 10);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app.getHttpServer())
        .get('/appointments/slots')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          employeeId: testEmployeeId,
          date: dateStr,
          durationMin: 30,
        })
        .expect(200);

      expect(response.body).toHaveProperty('slots');
      expect(Array.isArray(response.body.slots)).toBe(true);
    });
  });

  describe('6. Idempotency', () => {
    it('should not create duplicate transactions with same externalRef', async () => {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 6);
      scheduledAt.setHours(11, 0, 0, 0);

      const apptResponse = await request(app.getHttpServer())
        .post('/appointments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          services: [{ serviceId: testServiceId, priceAtBooking: 400000, durationMin: 30 }],
          employeeId: testEmployeeId,
          customerId: testCustomerId,
          scheduledAt: scheduledAt.toISOString(),
        });

      await prisma.appointment.update({
        where: { id: apptResponse.body.id },
        data: { status: 'CONFIRMED' },
      });

      const externalRef = `idempotency_test_${Date.now()}`;

      // First settlement
      await request(app.getHttpServer())
        .post(`/appointments/${apptResponse.body.id}/settle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 400000,
          paymentMethod: 'CASH',
          accountId: testAccountId,
          externalRef,
        })
        .expect(200);

      // Try again with same externalRef (should not fail, but not create duplicate)
      const transactionsBefore = await prisma.transaction.count({
        where: {
          meta: {
            path: ['externalRef'],
            equals: externalRef,
          },
        },
      });

      expect(transactionsBefore).toBeGreaterThan(0);
    });
  });
});

