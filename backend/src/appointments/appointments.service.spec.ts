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
import { PRICE_OVERRIDE_REASON_REQUIRED_FA } from './appointments.service';

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
      updateMany: jest.fn(),
      aggregate: jest.fn(),
      delete: jest.fn(),
    },
    customer: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    employee: {
      findUnique: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCalendarService = {
    toGregorian: jest.fn(),
    toJalali: jest.fn(),
    ensureExists: jest.fn(),
    getByGregorian: jest.fn(),
  };

  const mockSmsOutbound = {
    sendTemplated: jest.fn(),
    sendIfAllowed: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockSmsTemplates = {
    getByKey: jest.fn(),
    renderByKey: jest.fn().mockResolvedValue('sms-body'),
  };

  const mockNotificationsService = {
    create: jest.fn().mockResolvedValue({ id: 1 }),
  };

  const mockNotificationsGateway = {
    sendToRole: jest.fn(),
    sendToUser: jest.fn(),
  };

  const mockPushNotifications = {
    sendToRole: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AccountingService, useValue: {} },
        { provide: NotificationsService, useValue: mockNotificationsService },
        { provide: NotificationsGateway, useValue: mockNotificationsGateway },
        { provide: PushNotificationsService, useValue: mockPushNotifications },
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: SmsOutboundService, useValue: mockSmsOutbound },
        { provide: SmsTemplateService, useValue: mockSmsTemplates },
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

    it('applies paymentMethod to the list and summary where clause', async () => {
      mockPrismaService.appointment.findMany.mockResolvedValue([]);
      mockPrismaService.appointment.count.mockResolvedValue(0);
      mockPrismaService.appointment.aggregate.mockResolvedValue({ _sum: { amount: 0n } });

      await service.findAll({ paymentMethod: 'CARD' } as any, { id: 1, role: 'ADMIN' });
      await service.getSummary({ paymentMethod: 'CARD' } as any, { id: 1, role: 'ADMIN' });

      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentMethod: 'CARD', deletedAt: null }),
        }),
      );
      expect(mockPrismaService.appointment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentMethod: 'CARD' }),
        }),
      );
    });

    it('filters legacy rows with a null payment method without treating them as cash', async () => {
      mockPrismaService.appointment.count.mockResolvedValue(2);
      mockPrismaService.appointment.aggregate.mockResolvedValue({ _sum: { amount: null } });

      const summary = await service.getSummary(
        { paymentMethodUnset: true } as any,
        { id: 1, role: 'ADMIN' },
      );

      expect(summary.totalCount).toBe(2);
      expect(mockPrismaService.appointment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ paymentMethod: null }),
        }),
      );
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

    it('rejects times that are not on the 30-minute slot grid with an instructional message', async () => {
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
      ).rejects.toThrow('لطفاً زمان شروع نوبت را از اسلات‌های موجود انتخاب کنید.');
    });

    it('returns create without waiting for SMS provider response', async () => {
      let resolveSms: ((value: { success: boolean }) => void) | undefined;
      mockSmsOutbound.sendIfAllowed.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSms = resolve;
          }),
      );
      mockCalendarService.toGregorian.mockReturnValue(new Date(Date.UTC(2021, 2, 21)));
      mockCalendarService.toJalali.mockReturnValue('1400-01-01');
      mockCalendarService.ensureExists.mockResolvedValue({ id: 9 });
      mockPrismaService.customer.findUnique.mockResolvedValue({
        id: 1,
        user: { id: 1, name: 'John Doe', phone: '09123456789', email: 'john@example.com', role: 'CUSTOMER' },
      });
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
        user: { id: 2, name: 'Jane Smith', phone: '09987654321', role: 'EMPLOYEE' },
        employeeServices: [{ serviceId: 1 }],
      });
      mockPrismaService.service.findUnique.mockResolvedValue({
        id: 1,
        name: 'Haircut',
        price: 50000,
        durationMinutes: 30,
      });
      mockPrismaService.customer.updateMany.mockResolvedValue({ count: 0 });
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          appointment: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              ...appointmentRow,
              status: 'PENDING',
            }),
          },
          blockedTime: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        return fn(tx);
      });

      const started = Date.now();
      const result = await service.create(
        {
          customerId: 1,
          employeeId: 1,
          services: [{ serviceId: 1 }],
          jalaliDate: '1400-01-01',
          time: '14:00',
        } as any,
        { id: 1, role: 'ADMIN' },
      );
      expect(Date.now() - started).toBeLessThan(500);
      expect(result.id).toBe(1);
      await Promise.resolve();
      await Promise.resolve();
      expect(mockSmsOutbound.sendIfAllowed).toHaveBeenCalled();
      expect(resolveSms).toBeDefined();
      resolveSms?.({ success: true });
    });

    async function mockStaffCreate(durationMinutes = 30) {
      mockCalendarService.toGregorian.mockReturnValue(new Date(Date.UTC(2021, 2, 21)));
      mockCalendarService.ensureExists.mockResolvedValue({ id: 9 });
      mockPrismaService.customer.findUnique.mockResolvedValue({
        id: 1,
        user: { id: 1, name: 'John Doe', phone: '09123456789', role: 'CUSTOMER' },
      });
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
        user: { id: 2, name: 'Jane Smith', role: 'EMPLOYEE' },
        employeeServices: [{ serviceId: 1 }],
      });
      mockPrismaService.service.findUnique.mockResolvedValue({
        id: 1,
        name: 'Haircut',
        price: 50000,
        durationMinutes,
      });
      mockPrismaService.customer.updateMany.mockResolvedValue({ count: 0 });
      let created: { scheduledAt: Date; durationMin: number } | undefined;
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          appointment: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(async ({ data }: { data: { scheduledAt: Date; durationMin: number } }) => {
              created = data;
              return { ...appointmentRow, ...data, status: 'PENDING' };
            }),
          },
          blockedTime: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        await fn(tx);
        return { ...appointmentRow, status: 'PENDING' };
      });
      return () => created;
    }

    it('keeps 11:00 Tehran as the start and occupies 30 minutes forward', async () => {
      const created = await mockStaffCreate(30);
      await service.create(
        {
          customerId: 1,
          employeeId: 1,
          services: [{ serviceId: 1, durationMin: 30 }],
          jalaliDate: '1400-01-01',
          time: '11:00',
        } as any,
        { id: 1, role: 'ADMIN' },
      );
      const row = created();
      expect(row?.scheduledAt.toISOString()).toBe('2021-03-21T07:30:00.000Z');
      expect(row?.durationMin).toBe(30);
      expect(new Date(row!.scheduledAt.getTime() + 30 * 60 * 1000).toISOString()).toBe(
        '2021-03-21T08:00:00.000Z',
      );
    });

    it('keeps 11:00 Tehran as the start and occupies 120 minutes forward', async () => {
      const created = await mockStaffCreate(120);
      await service.create(
        {
          customerId: 1,
          employeeId: 1,
          services: [{ serviceId: 1, durationMin: 120 }],
          jalaliDate: '1400-01-01',
          time: '11:00',
        } as any,
        { id: 1, role: 'ADMIN' },
      );
      const row = created();
      expect(row?.scheduledAt.toISOString()).toBe('2021-03-21T07:30:00.000Z');
      expect(row?.durationMin).toBe(120);
      expect(new Date(row!.scheduledAt.getTime() + 120 * 60 * 1000).toISOString()).toBe(
        '2021-03-21T09:30:00.000Z',
      );
    });

    it('binds a customer booking to the JWT profile and ignores a spoofed customerId', async () => {
      mockCalendarService.toGregorian.mockReturnValue(new Date(Date.UTC(2030, 0, 1)));
      mockCalendarService.ensureExists.mockResolvedValue({ id: 9 });
      mockPrismaService.customer.findUnique.mockImplementation(async (args: { where: { userId?: number; id?: number } }) => {
        if (args.where.userId === 10) {
          return { id: 55, userId: 10 };
        }
        if (args.where.id === 55) {
          return {
            id: 55,
            userId: 10,
            user: { id: 10, name: 'Own', phone: '09120000000', role: 'CUSTOMER' },
          };
        }
        return null;
      });
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
        user: { id: 2, name: 'Jane Smith', role: 'EMPLOYEE' },
        employeeServices: [{ serviceId: 1 }],
      });
      mockPrismaService.service.findUnique.mockResolvedValue({
        id: 1,
        name: 'Haircut',
        price: 50000,
        durationMinutes: 30,
      });
      mockPrismaService.customer.updateMany.mockResolvedValue({ count: 0 });
      let createdCustomerId: number | undefined;
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          appointment: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(async ({ data }: { data: { customerId: number } }) => {
              createdCustomerId = data.customerId;
              return { ...appointmentRow, ...data, status: 'PENDING_CONFIRMATION' };
            }),
          },
          blockedTime: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        await fn(tx);
        return { ...appointmentRow, customerId: 55, status: 'PENDING_CONFIRMATION' };
      });

      await service.create(
        {
          customerId: 999,
          employeeId: 1,
          services: [{ serviceId: 1 }],
          jalaliDate: '1408-10-11',
          time: '11:00',
        } as any,
        { id: 10, role: 'CUSTOMER' },
      );

      expect(createdCustomerId).toBe(55);
      expect(mockPrismaService.customer.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 55 }) }),
      );
      const lookedUpIds = mockPrismaService.customer.findUnique.mock.calls.map(
        (call: [{ where: { id?: number } }]) => call[0].where.id,
      );
      expect(lookedUpIds).not.toContain(999);
    });

    it('rejects a customer actor who has no customer profile', async () => {
      mockPrismaService.customer.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            customerId: 999,
            employeeId: 1,
            services: [{ serviceId: 1 }],
            jalaliDate: '1408-10-11',
            time: '11:00',
          } as any,
          { id: 10, role: 'CUSTOMER' },
        ),
      ).rejects.toThrow('Customer profile not found');
    });

    it('uses the service duration when the payload omits durationMin', async () => {
      const created = await mockStaffCreate(30);
      await service.create(
        {
          customerId: 1,
          employeeId: 1,
          services: [{ serviceId: 1 }],
          jalaliDate: '1400-01-01',
          time: '11:00',
        } as any,
        { id: 1, role: 'ADMIN' },
      );
      expect(created()?.durationMin).toBe(30);
    });

    it.each(['ADMIN', 'EMPLOYEE'])(
      'keeps %s desk price and duration when the client supplies them',
      async (role) => {
        const created = await mockStaffCreate(30);
        await service.create(
          {
            customerId: 1,
            employeeId: 1,
            services: [{ serviceId: 1, priceAtBooking: 111, durationMin: 45 }],
            durationMin: 45,
            jalaliDate: '1400-01-01',
            time: '11:00',
          } as any,
          { id: 1, role },
        );
        const row = created() as unknown as {
          durationMin: number;
          services: Array<{ priceAtBooking: number; durationMin: number }>;
        };
        expect(row.services[0].priceAtBooking).toBe(111);
        expect(row.services[0].durationMin).toBe(45);
        expect(row.durationMin).toBe(45);
      },
    );

    it('derives customer price and duration from the service and ignores client values', async () => {
      mockCalendarService.toGregorian.mockReturnValue(new Date(Date.UTC(2030, 0, 1)));
      mockCalendarService.ensureExists.mockResolvedValue({ id: 9 });
      mockPrismaService.customer.findUnique.mockImplementation(async (args: { where: { userId?: number; id?: number } }) => {
        if (args.where.userId === 10) return { id: 55, userId: 10 };
        if (args.where.id === 55) {
          return { id: 55, userId: 10, user: { id: 10, name: 'Own', role: 'CUSTOMER' } };
        }
        return null;
      });
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
        user: { id: 2, role: 'EMPLOYEE' },
        employeeServices: [{ serviceId: 1 }],
      });
      mockPrismaService.service.findUnique.mockResolvedValue({
        id: 1,
        name: 'Haircut',
        price: 50000,
        durationMinutes: 30,
      });
      mockPrismaService.customer.updateMany.mockResolvedValue({ count: 0 });
      let created: { durationMin: number; services: Array<{ priceAtBooking: number; durationMin: number }> } | undefined;
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => unknown) => {
        const tx = {
          $executeRaw: jest.fn().mockResolvedValue(undefined),
          appointment: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation(async ({ data }: { data: typeof created }) => {
              created = data;
              return { ...appointmentRow, ...data, status: 'PENDING_CONFIRMATION' };
            }),
          },
          blockedTime: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        await fn(tx);
        return { ...appointmentRow, status: 'PENDING_CONFIRMATION' };
      });

      await service.create(
        {
          customerId: 999,
          employeeId: 1,
          services: [{ serviceId: 1, priceAtBooking: 1, durationMin: 1 }],
          durationMin: 5,
          jalaliDate: '1408-10-11',
          time: '11:00',
        } as any,
        { id: 10, role: 'CUSTOMER' },
      );

      expect(created?.services[0].priceAtBooking).toBe(500000);
      expect(created?.services[0].durationMin).toBe(30);
      expect(created?.durationMin).toBe(30);
    });

    it('rejects a customer booking when service price or duration is not authoritative', async () => {
      mockCalendarService.toGregorian.mockReturnValue(new Date(Date.UTC(2030, 0, 1)));
      mockCalendarService.ensureExists.mockResolvedValue({ id: 9 });
      mockPrismaService.customer.findUnique.mockImplementation(async (args: { where: { userId?: number; id?: number } }) => {
        if (args.where.userId === 10) return { id: 55, userId: 10 };
        if (args.where.id === 55) {
          return { id: 55, userId: 10, user: { id: 10, role: 'CUSTOMER' } };
        }
        return null;
      });
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
        user: { role: 'EMPLOYEE' },
        employeeServices: [{ serviceId: 1 }],
      });
      mockPrismaService.service.findUnique.mockResolvedValue({
        id: 1,
        name: 'Haircut',
        price: -1,
        durationMinutes: 0,
      });

      await expect(
        service.create(
          {
            customerId: 55,
            employeeId: 1,
            services: [{ serviceId: 1, priceAtBooking: 999, durationMin: 15 }],
            jalaliDate: '1408-10-11',
            time: '11:00',
          } as any,
          { id: 10, role: 'CUSTOMER' },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a customer booking when the service does not exist', async () => {
      mockCalendarService.toGregorian.mockReturnValue(new Date(Date.UTC(2030, 0, 1)));
      mockCalendarService.ensureExists.mockResolvedValue({ id: 9 });
      mockPrismaService.customer.findUnique.mockImplementation(async (args: { where: { userId?: number; id?: number } }) => {
        if (args.where.userId === 10) return { id: 55, userId: 10 };
        if (args.where.id === 55) {
          return { id: 55, userId: 10, user: { id: 10, role: 'CUSTOMER' } };
        }
        return null;
      });
      mockPrismaService.employee.findUnique.mockResolvedValue({
        id: 1,
        isActive: true,
        user: { role: 'EMPLOYEE' },
        employeeServices: [{ serviceId: 1 }],
      });
      mockPrismaService.service.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            customerId: 55,
            employeeId: 1,
            services: [{ serviceId: 1, priceAtBooking: 999, durationMin: 15 }],
            jalaliDate: '1408-10-11',
            time: '11:00',
          } as any,
          { id: 10, role: 'CUSTOMER' },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when appointment is missing', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(null);

      await expect(
        service.update(999, { notes: 'x' } as any, { id: 1, role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('requires a reason when staff price or duration differs from the service', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(appointmentRow);
      mockPrismaService.service.findUnique.mockResolvedValue({
        id: 1,
        price: 50000,
        durationMinutes: 30,
        name: 'Haircut',
      });

      await expect(
        service.update(
          1,
          { services: [{ serviceId: 1, priceAtBooking: 111, durationMin: 45 }] } as any,
          { id: 1, role: 'ADMIN' },
        ),
      ).rejects.toThrow(PRICE_OVERRIDE_REASON_REQUIRED_FA);
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
    });

    it('persists priceOverrideReason when a staff override is justified', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(appointmentRow);
      mockPrismaService.service.findUnique.mockResolvedValue({
        id: 1,
        price: 50000,
        durationMinutes: 30,
        name: 'Haircut',
      });
      mockPrismaService.appointment.update.mockResolvedValue({
        ...appointmentRow,
        durationMin: 45,
        priceOverrideReason: 'desk extension',
      });

      const result = await service.update(
        1,
        {
          services: [{ serviceId: 1, durationMin: 45 }],
          priceOverrideReason: '  desk extension  ',
        } as any,
        { id: 1, role: 'ADMIN' },
      );

      expect(mockPrismaService.appointment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priceOverrideReason: 'desk extension' }),
        }),
      );
      expect(result.priceOverrideReason).toBe('desk extension');
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

    it('requires a reason when the settlement amount differs from the service total', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(appointmentRow);

      await expect(
        service.settle(
          1,
          { amount: 1, paymentMethod: 'CASH' } as any,
          { id: 1, role: 'ADMIN' },
        ),
      ).rejects.toThrow(PRICE_OVERRIDE_REASON_REQUIRED_FA);
    });

    it('persists priceOverrideReason on an overridden settlement', async () => {
      mockPrismaService.appointment.findFirst.mockResolvedValue(appointmentRow);
      mockPrismaService.transaction.findFirst.mockResolvedValue(null);
      const update = jest.fn().mockResolvedValue({
        ...appointmentRow,
        status: 'SETTLED',
        priceOverrideReason: 'manager discount',
      });
      mockPrismaService.$transaction.mockImplementation(async (fn: (tx: any) => unknown) =>
        fn({
          $queryRaw: jest.fn(),
          appointment: {
            findUnique: jest.fn().mockResolvedValue({ ...appointmentRow, deletedAt: null }),
            update,
          },
          transaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockRejectedValue(new Error('stop-after-persist')),
          },
        }),
      );

      await expect(
        service.settle(
          1,
          {
            amount: 100,
            paymentMethod: 'CASH',
            accountId: 1,
            priceOverrideReason: ' manager discount ',
          } as any,
          { id: 1, role: 'ADMIN' },
        ),
      ).rejects.toThrow('stop-after-persist');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ priceOverrideReason: 'manager discount' }),
        }),
      );
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

    it('returns cancel without waiting for SMS provider response', async () => {
      let resolveSms: ((value: { success: boolean }) => void) | undefined;
      mockSmsOutbound.sendIfAllowed.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSms = resolve;
          }),
      );
      mockPrismaService.appointment.findFirst
        .mockResolvedValueOnce(appointmentRow)
        .mockResolvedValueOnce({
          ...appointmentRow,
          status: 'CANCELLED',
          calendarDate: { jalaliDate: '1402-10-25' },
        });
      mockPrismaService.appointment.updateMany.mockResolvedValue({ count: 1 });

      const started = Date.now();
      const result = await service.cancel(1, { id: 1, role: 'ADMIN' });
      expect(Date.now() - started).toBeLessThan(500);
      expect(result.status).toBe('CANCELLED');
      expect(mockPrismaService.appointment.update).not.toHaveBeenCalled();
      expect(mockPrismaService.appointment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 1,
            status: { notIn: ['CANCELLED', 'SETTLED', 'PAID'] },
          }),
          data: { status: 'CANCELLED' },
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(mockSmsOutbound.sendIfAllowed).toHaveBeenCalled();
      expect(resolveSms).toBeDefined();
      resolveSms?.({ success: true });
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
