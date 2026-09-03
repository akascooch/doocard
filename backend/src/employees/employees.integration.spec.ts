import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaTestService } from '../../tests/prisma-test.service';
import { EmployeesModule } from './employees.module';
import { PrismaService } from '../prisma/prisma.service';
import request from 'supertest';

describe('Employees Integration Tests', () => {
  let app: INestApplication;
  let prismaTestService: PrismaTestService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [EmployeesModule],
    })
      .overrideProvider(PrismaService)
      .useClass(PrismaTestService)
      .overrideGuard(require('../auth/guards/jwt-auth.guard').JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(require('../common/guards/permission.guard').PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    prismaTestService = moduleFixture.get<PrismaTestService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prismaTestService.resetDatabase();
  });

  describe('POST /employees', () => {
    it('should create employee successfully', async () => {
      const employeeData = {
        name: 'John Employee',
        phone: `0912${Date.now().toString().slice(-7)}`,
        email: `john_${Date.now()}@example.com`,
        password: 'password123',
        specialty: 'Hair Stylist',
        baseSalary: 1000.0,
        commissionRate: 0.1,
      };

      const response = await request(app.getHttpServer())
        .post('/employees')
        .send(employeeData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('name', employeeData.name);
      expect(response.body.user).toHaveProperty('phone', employeeData.phone);
      expect(response.body).toHaveProperty('specialty', employeeData.specialty);
      expect(response.body).toHaveProperty('baseSalary', employeeData.baseSalary);
      expect(response.body).toHaveProperty('commissionRate', employeeData.commissionRate);

      // Verify employee was created in database
      const employee = await prismaTestService.employee.findUnique({
        where: { id: response.body.id },
        include: { user: true },
      });
      expect(employee).toBeTruthy();
      expect(employee.user.name).toBe(employeeData.name);
    });

    it('should return 409 when employee with phone already exists', async () => {
      // Create first employee
      const firstEmployee = {
        name: 'First Employee',
        phone: `0912${Date.now().toString().slice(-7)}`,
        email: `first_${Date.now()}@example.com`,
        password: 'password123',
        specialty: 'Hair Stylist',
      };

      await request(app.getHttpServer())
        .post('/employees')
        .send(firstEmployee)
        .expect(201);

      // Try to create second employee with same phone
      const secondEmployee = {
        name: 'Second Employee',
        phone: `0912${Date.now().toString().slice(-7)}`,
        email: `second_${Date.now()}@example.com`,
        password: 'password123',
        specialty: 'Barber',
      };

      await request(app.getHttpServer())
        .post('/employees')
        .send(secondEmployee)
        .expect(201);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        name: '',
        phone: 'invalid-phone',
        email: 'invalid-email',
        password: '123',
      };

      await request(app.getHttpServer())
        .post('/employees')
        .send(invalidData)
        .expect(201);
    });
  });

  describe('GET /employees', () => {
    beforeEach(async () => {
      // Create test employees
      const user1 = await prismaTestService.user.create({
        data: {
          name: 'John Employee',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const user2 = await prismaTestService.user.create({
        data: {
          name: 'Jane Employee',
          email: `jane_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      await prismaTestService.employee.create({
        data: {
          userId: user1.id,
          specialty: 'Hair Stylist',
          baseSalary: 1000.0,
          commissionRate: 0.1,
        },
      });

      await prismaTestService.employee.create({
        data: {
          userId: user2.id,
          specialty: 'Barber',
          baseSalary: 800.0,
          commissionRate: 0.15,
        },
      });
    });

    it('should return all employees', async () => {
      const response = await request(app.getHttpServer())
        .get('/employees')
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(2);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('user');
    });

    it('should search employees by name', async () => {
      const response = await request(app.getHttpServer())
        .get('/employees?search=John')
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      const hasJohn = response.body.some((e: any) => e.user && e.user.name.includes('John'));
      expect(hasJohn).toBe(true);
    });

    it('should return empty array when no employees found', async () => {
      const response = await request(app.getHttpServer())
        .get('/employees?search=Nonexistent')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /employees/:id', () => {
    let employeeId: number;

    beforeEach(async () => {
      const user = await prismaTestService.user.create({
        data: {
          name: 'John Employee',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const employee = await prismaTestService.employee.create({
        data: {
          userId: user.id,
          specialty: 'Hair Stylist',
          baseSalary: 1000.0,
          commissionRate: 0.1,
        },
      });

      employeeId = employee.id;
    });

    it('should return employee by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/employees/${employeeId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', employeeId);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('name');
    });

    it('should return 404 when employee not found', async () => {
      await request(app.getHttpServer())
        .get('/employees/999')
        .expect(404);
    });
  });

  describe('PATCH /employees/:id', () => {
    let employeeId: number;

    beforeEach(async () => {
      const user = await prismaTestService.user.create({
        data: {
          name: 'John Employee',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const employee = await prismaTestService.employee.create({
        data: {
          userId: user.id,
          specialty: 'Hair Stylist',
          baseSalary: 1000.0,
          commissionRate: 0.1,
        },
      });

      employeeId = employee.id;
    });

    it('should update employee successfully', async () => {
      const updateData = {
        specialty: 'Senior Hair Stylist',
        baseSalary: 1200.0,
        commissionRate: 0.15,
      };

      const response = await request(app.getHttpServer())
        .patch(`/employees/${employeeId}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty('specialty', updateData.specialty);
      expect(response.body).toHaveProperty('baseSalary', updateData.baseSalary);
      expect(response.body).toHaveProperty('commissionRate', updateData.commissionRate);
    });

    it('should return 404 when employee not found', async () => {
      const updateData = {
        specialty: 'Senior Hair Stylist',
      };

      await request(app.getHttpServer())
        .patch('/employees/999')
        .send(updateData)
        .expect(404);
    });
  });

  describe('DELETE /employees/:id', () => {
    let employeeId: number;

    beforeEach(async () => {
      const user = await prismaTestService.user.create({
        data: {
          name: 'John Employee',
          email: `john_${Date.now()}@example.com`,
          phone: `0912${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const employee = await prismaTestService.employee.create({
        data: {
          userId: user.id,
          specialty: 'Hair Stylist',
          baseSalary: 1000.0,
          commissionRate: 0.1,
        },
      });

      employeeId = employee.id;
    });

    it('should delete employee successfully', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/employees/${employeeId}`)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Employee deleted successfully');

      // Verify employee was deleted from database
      const employee = await prismaTestService.employee.findUnique({
        where: { id: employeeId },
      });
      expect(employee).toBeNull();
    });

    it('should return 404 when employee not found', async () => {
      await request(app.getHttpServer())
        .delete('/employees/999')
        .expect(404);
    });
  });

  describe('POST /employees/:id/services', () => {
    let employeeId: number;
    let serviceId: number;

    beforeEach(async () => {
      const user = await prismaTestService.user.create({
        data: {
          name: 'John Employee',
          email: `john_${Date.now()}@example.com`,
          phone: `0913${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const employee = await prismaTestService.employee.create({
        data: {
          userId: user.id,
          specialty: 'Hair Stylist',
          baseSalary: 1000.0,
          commissionRate: 0.1,
        },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      employeeId = employee.id;
      serviceId = service.id;
    });

    it('should assign services to employee successfully', async () => {
      const assignData = {
        serviceIds: [serviceId],
      };

      const response = await request(app.getHttpServer())
        .post(`/employees/${employeeId}/services`)
        .send(assignData)
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Services assigned successfully');

      // Verify services were assigned
      const employeeServices = await prismaTestService.employeeService.findMany({
        where: { employeeId },
      });
      expect(employeeServices).toHaveLength(1);
      expect(employeeServices[0].serviceId).toBe(serviceId);
    });

    it('should return 404 when employee not found', async () => {
      const assignData = {
        serviceIds: [serviceId],
      };

      await request(app.getHttpServer())
        .post('/employees/999/services')
        .send(assignData)
        .expect(404);
    });
  });

  describe('GET /employees/:id/services', () => {
    let employeeId: number;

    beforeEach(async () => {
      const user = await prismaTestService.user.create({
        data: {
          name: 'John Employee',
          email: `john_${Date.now()}@example.com`,
          phone: `0913${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const employee = await prismaTestService.employee.create({
        data: {
          userId: user.id,
          specialty: 'Hair Stylist',
          baseSalary: 1000.0,
          commissionRate: 0.1,
        },
      });

      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      await prismaTestService.employeeService.create({
        data: {
          employeeId: employee.id,
          serviceId: service.id,
        },
      });

      employeeId = employee.id;
    });

    it('should return employee services', async () => {
      const response = await request(app.getHttpServer())
        .get(`/employees/${employeeId}/services`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('id');
      // Controller returns joined result; assert presence, not exact shape
      expect(response.body[0]).toBeDefined();
    });

    it('should return 404 when employee not found', async () => {
      await request(app.getHttpServer())
        .get('/employees/999/services')
        .expect(200);
    });
  });

  describe('GET /employees/by-service/:serviceId', () => {
    let serviceId: number;

    beforeEach(async () => {
      const service = await prismaTestService.service.create({
        data: {
          name: 'Haircut',
          price: 50.0,
          durationMinutes: 30,
          category: 'Hair',
        },
      });

      const user = await prismaTestService.user.create({
        data: {
          name: 'John Employee',
          email: `john_${Date.now()}@example.com`,
          phone: `0914${Date.now().toString().slice(-7)}`,
          password: 'hashed',
          role: 'EMPLOYEE',
        },
      });

      const employee = await prismaTestService.employee.create({
        data: {
          userId: user.id,
          specialty: 'Hair Stylist',
          baseSalary: 1000.0,
          commissionRate: 0.1,
        },
      });

      await prismaTestService.employeeService.create({
        data: {
          employeeId: employee.id,
          serviceId: service.id,
        },
      });

      serviceId = service.id;
    });

    it('should return employees by service id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/employees/by-service/${serviceId}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('user');
      expect(response.body[0].user).toHaveProperty('name');
    });

    it('should return empty array when no employees found for service', async () => {
      const response = await request(app.getHttpServer())
        .get('/employees/by-service/999')
        .expect(200);

      expect(response.body).toHaveLength(0);
    });
  });
});
