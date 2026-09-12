import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountingService } from '../accounting/accounting.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { CalendarService } from '../calendar/calendar.service';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SmsTemplateService } from '../sms/sms-template.service';
import { TipAlertService } from '../sms/tip-alert.service';
import { APPOINTMENT_NOT_FOUND_FA } from './appointment-access.util';

describe('AppointmentsService', () => {
  let service: AppointmentsService;

  const appointmentRow = {
    id: 1,
    customerId: 1,
    employeeId: 1,
    status: 'CONFIRMED',
    services: [{ serviceId: 1, priceAtBooking: 500000, durationMin: 30, serviceName: 'Haircut' }],
    scheduledAt: new Date('2024-01-15T10:00:00Z'),
    durationMin: 30,
    amount: null,
    financiallyLockedAt: null,
    deletedAt: null,
    customer: {
      id: 1,
      userId: 1,
      user: { id: 1, name: 'John Doe', email: 'john@example.com', phone: '09123456789', role: 'CUSTOMER' },
    },
    employee: {
      id: 1,
      userId: 2,
      user: { id: 2, name: 'Jane Smith', email: 'jane@example.com', phone: '09987654321', role: 'EMPLOYEE' },
    },
    transactions: [],
  };

  const mockPrismaService = {
    appointment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
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
    $transaction: jest.fn(),
  };

  const mockCalendarService = {
    toGregorian: jest.fn(),
    toJalali: jest.fn(),
    ensureExists: jest.fn(),
    getByGregorian: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AccountingService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: NotificationsGateway, useValue: {} },
        { provide: PushNotificationsService, useValue: {} },
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: SmsOutboundService, useValue: { sendTemplated: jest.fn() } },
        { provide: SmsTemplateService, useValue: { getByKey: jest.fn() } },
        { provide: TipAlertService, useValue: { notify: jest.fn() } },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns a paginated list for admin without employee scoping', async () => {
      mockPrismaService.appointment.findMany.mockResolvedValue([appointmentRow]);
      mockPrismaService.appointment.count.mockResolvedValue(1);

      const result = await service.findAll({} as any, { id: 1, role: 'ADMIN' });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.take).toBe(200);
      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
          orderBy: { scheduledAt: 'desc' },
        }),
      );
      expect(mockPrismaService.employee.findUnique).not.toHaveBeenCalled();
    });

    it('scopes customer lists to the authenticated customer profile', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue({ id: 1, userId: 9 });
      mockPrismaService.appointment.findMany.mockResolvedValue([appointmentRow]);
      mockPrismaService.appointment.count.mockResolvedValue(1);

      await service.findAll({} as any, { id: 9, role: 'CUSTOMER' });

      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 1, deletedAt: null }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the formatted appointment when found', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(appointmentRow);

      const result = await service.findOne(1, { id: 1, role: 'ADMIN' });

      expect(result.id).toBe(1);
      expect(result.customerId).toBe(1);
      expect(result.employeeId).toBe(1);
    });

    it('throws NotFoundException when appointment is missing', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(service.findOne(999, { id: 1, role: 'ADMIN' })).rejects.toThrow(NotFoundException);
      await expect(service.findOne(999, { id: 1, role: 'ADMIN' })).rejects.toThrow(
        APPOINTMENT_NOT_FOUND_FA,
      );
    });
  });

  describe('create', () => {
    it('rejects payloads without jalaliDate+time or scheduledAt', async () => {
      await expect(
        service.create(
          { customerId: 1, employeeId: 1, services: [{ serviceId: 1 }] } as any,
          { id: 1, role: 'ADMIN' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects times that are not on the 30-minute slot grid', async () => {
      mockCalendarService.toGregorian.mockReturnValue(new Date(Date.UTC(2021, 2, 21)));

      await expect(
        service.create(
          {
            customerId: 1,
            employeeId: 1,
            services: [{ serviceId: 1 }],
            jalaliDate: '1400-01-01',
            time: '14:15',
          } as any,
          { id: 1, role: 'ADMIN' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when appointment is missing', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(999, { notes: 'x' } as any, { id: 1, role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes an unsettled appointment', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(appointmentRow);
      mockPrismaService.appointment.update.mockResolvedValue({
        ...appointmentRow,
        deletedAt: new Date(),
      });

      const result = await service.remove(1, { id: 1, role: 'ADMIN' });

      expect(result).toEqual({ message: 'Appointment deleted successfully' });
      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
      expect(mockPrismaService.appointment.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when appointment is missing', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(service.remove(999, { id: 1, role: 'ADMIN' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('settle', () => {
    it('throws NotFoundException when appointment is missing', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.settle(999, { amount: 1 } as any, { id: 1, role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects settling an already settled appointment', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        ...appointmentRow,
        status: 'SETTLED',
      });

      await expect(
        service.settle(1, { amount: 1 } as any, { id: 1, role: 'ADMIN' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when appointment is missing', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(service.cancel(999, { id: 1, role: 'ADMIN' })).rejects.toThrow(NotFoundException);
    });

    it('rejects cancelling a settled appointment', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue({
        ...appointmentRow,
        status: 'SETTLED',
      });

      await expect(service.cancel(1, { id: 1, role: 'ADMIN' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('getAvailableSlots', () => {
    it('throws NotFoundException when the employee does not exist', async () => {
      mockPrismaService.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.getAvailableSlots({ employeeId: 99, date: '2030-06-15' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
