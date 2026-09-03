import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prismaService: PrismaService;

  const mockAppointment = {
    id: 1,
    customerId: 1,
    employeeId: 1,
    serviceId: 1,
    scheduledAt: new Date('2024-01-15T10:00:00Z'),
    status: 'PENDING',
    customer: {
      id: 1,
      userId: 1,
      user: {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        phone: '09123456789',
      },
    },
    employee: {
      id: 1,
      userId: 2,
      user: {
        id: 2,
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '09987654321',
      },
    },
    service: {
      id: 1,
      name: 'Haircut',
      price: 50.0,
      durationMinutes: 30,
    },
    transactions: [],
  };

  const mockPrismaService = {
    appointment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all appointments for admin user', async () => {
      const currentUser = { role: 'ADMIN' };
      mockPrismaService.appointment.findMany.mockResolvedValue([mockAppointment]);

      const result = await service.findAll(currentUser);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith({
        include: expect.any(Object),
        orderBy: { scheduledAt: 'desc' },
      });
    });

    it('should return employee appointments for employee user', async () => {
      const currentUser = { role: 'EMPLOYEE', email: 'jane@example.com' };
      mockPrismaService.user.findFirst.mockResolvedValue({
        id: 2,
        email: 'jane@example.com',
        employee: { id: 1 },
      });
      mockPrismaService.appointment.findMany.mockResolvedValue([mockAppointment]);

      const result = await service.findAll(currentUser);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith({
        where: { employeeId: 1 },
        include: expect.any(Object),
        orderBy: { scheduledAt: 'desc' },
      });
    });

    it('should return customer appointments for customer user', async () => {
      const currentUser = { role: 'CUSTOMER', id: 1 };
      mockPrismaService.appointment.findMany.mockResolvedValue([mockAppointment]);

      const result = await service.findAll(currentUser);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith({
        where: { customerId: 1 },
        include: expect.any(Object),
        orderBy: { scheduledAt: 'desc' },
      });
    });
  });

  describe('findOne', () => {
    it('should return appointment when found', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(mockAppointment);

      const result = await service.findOne(1);

      expect(result).toHaveProperty('totalAmount', 50.0);
      expect(result).toHaveProperty('paidAmount', 0);
      expect(result).toHaveProperty('isPaid', false);
      expect(result).toHaveProperty('customerName', 'John Doe');
      expect(result).toHaveProperty('employeeName', 'Jane Smith');
      expect(result).toHaveProperty('serviceName', 'Haircut');
    });

    it('should throw NotFoundException when appointment not found', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const createAppointmentDto = {
      customerId: 1,
      employeeId: 1,
      serviceId: 1,
      scheduledAt: '2024-01-15T10:00:00Z',
      status: 'PENDING',
    };

    it('should create appointment successfully', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockPrismaService.employee.findUnique.mockResolvedValue({ id: 1, userId: 2 });
      mockPrismaService.service.findUnique.mockResolvedValue({ id: 1, name: 'Haircut', price: 50.0 });
      mockPrismaService.appointment.create.mockResolvedValue(mockAppointment);

      const result = await service.create(createAppointmentDto);

      expect(result).toHaveProperty('totalAmount', 50.0);
      expect(mockPrismaService.appointment.create).toHaveBeenCalledWith({
        data: {
          customerId: 1,
          employeeId: 1,
          serviceId: 1,
          scheduledAt: new Date('2024-01-15T10:00:00Z'),
          status: 'PENDING',
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when customer not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.create(createAppointmentDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when employee not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.create(createAppointmentDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when service not found', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({ id: 1, userId: 1 });
      mockPrismaService.employee.findUnique.mockResolvedValue({ id: 1, userId: 2 });
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(service.create(createAppointmentDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateAppointmentDto = {
      status: 'CONFIRMED',
    };

    it('should update appointment successfully', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(mockAppointment);
      mockPrismaService.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: 'CONFIRMED',
      });

      const result = await service.update(1, updateAppointmentDto);

      expect(result.status).toBe('CONFIRMED');
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'CONFIRMED' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when appointment not found', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(service.update(999, updateAppointmentDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete appointment successfully', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(mockAppointment);
      mockPrismaService.transaction.deleteMany.mockResolvedValue({ count: 0 });
      mockPrismaService.appointment.delete.mockResolvedValue(mockAppointment);

      const result = await service.remove(1);

      expect(result).toEqual({ message: 'Appointment deleted successfully' });
      expect(mockPrismaService.transaction.deleteMany).toHaveBeenCalledWith({
        where: { relatedId: 1 },
      });
      expect(mockPrismaService.appointment.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should throw NotFoundException when appointment not found', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('settleAppointment', () => {
    it('should settle appointment successfully', async () => {
      const settledAppointment = { ...mockAppointment, status: 'COMPLETED' };
      mockPrismaService.appointment.findUnique.mockResolvedValue(mockAppointment);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback({
          appointment: {
            update: jest.fn().mockResolvedValue(settledAppointment),
          },
          transaction: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        });
      });

      const result = await service.settleAppointment(1);

      expect(result.status).toBe('COMPLETED');
    });

    it('should throw NotFoundException when appointment not found', async () => {
      mockPrismaService.appointment.findUnique.mockResolvedValue(null);

      await expect(service.settleAppointment(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when appointment already settled', async () => {
      const completedAppointment = { ...mockAppointment, status: 'COMPLETED' };
      mockPrismaService.appointment.findUnique.mockResolvedValue(completedAppointment);

      await expect(service.settleAppointment(1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelAppointment', () => {
    it('should cancel appointment successfully', async () => {
      const currentUser = { role: 'CUSTOMER', id: 1 };
      mockPrismaService.appointment.findUnique.mockResolvedValue(mockAppointment);
      mockPrismaService.appointment.update.mockResolvedValue({
        ...mockAppointment,
        status: 'CANCELLED',
      });

      const result = await service.cancelAppointment(1, currentUser);

      expect(result.status).toBe('CANCELLED');
    });

    it('should throw BadRequestException when user tries to cancel others appointment', async () => {
      const currentUser = { role: 'CUSTOMER', id: 999 };
      mockPrismaService.appointment.findUnique.mockResolvedValue(mockAppointment);

      await expect(service.cancelAppointment(1, currentUser)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when appointment already cancelled', async () => {
      const currentUser = { role: 'CUSTOMER', id: 1 };
      const cancelledAppointment = { ...mockAppointment, status: 'CANCELLED' };
      mockPrismaService.appointment.findUnique.mockResolvedValue(cancelledAppointment);

      await expect(service.cancelAppointment(1, currentUser)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available slots for a given date and employee', async () => {
      const date = new Date('2024-01-15');
      const employeeId = 1;
      
      mockPrismaService.appointment.findMany.mockResolvedValue([]);

      const result = await service.getAvailableSlots(date, employeeId);

      expect(result).toHaveProperty('slots');
      expect(result).toHaveProperty('date');
      expect(Array.isArray(result.slots)).toBe(true);
    });
  });

  describe('getPublicServices', () => {
    it('should return public services', async () => {
      const mockServices = [
        { id: 1, name: 'Haircut', category: 'Hair', durationMinutes: 30, price: 50.0 },
        { id: 2, name: 'Beard Trim', category: 'Beard', durationMinutes: 15, price: 25.0 },
      ];

      mockPrismaService.service.findMany.mockResolvedValue(mockServices);

      const result = await service.getPublicServices();

      expect(result).toEqual(mockServices);
      expect(mockPrismaService.service.findMany).toHaveBeenCalledWith({
        select: {
          id: true,
          name: true,
          category: true,
          durationMinutes: true,
          price: true,
        },
        orderBy: { name: 'asc' },
      });
    });
  });
});
