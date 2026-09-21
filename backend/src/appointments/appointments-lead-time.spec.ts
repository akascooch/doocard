import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

const LEAD_TIME_FA = 'زمان رزرو باید حداقل ۲ ساعت از زمان فعلی جلوتر باشد';

describe('AppointmentsService public 2h lead time (create)', () => {
  let service: AppointmentsService;

  const mockPrisma = {
    customer: { findUnique: jest.fn() },
    employee: { findUnique: jest.fn() },
    appointment: { findUnique: jest.fn() },
  };

  const mockCalendarService = {
    toGregorian: jest.fn(),
    toJalali: jest.fn(),
    ensureExists: jest.fn().mockResolvedValue({ id: 1 }),
    getByGregorian: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AccountingService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: NotificationsGateway, useValue: {} },
        { provide: PushNotificationsService, useValue: {} },
        { provide: CalendarService, useValue: mockCalendarService },
        { provide: SmsOutboundService, useValue: { sendIfAllowed: jest.fn() } },
        { provide: SmsTemplateService, useValue: { renderByKey: jest.fn() } },
        { provide: TipAlertService, useValue: { notify: jest.fn() } },
      ],
    }).compile();

    service = module.get(AppointmentsService);
    jest.clearAllMocks();
    mockCalendarService.ensureExists.mockResolvedValue({ id: 1 });
    mockPrisma.customer.findUnique.mockResolvedValue(null);
  });

  const dtoAt = (iso: string) =>
    ({
      customerId: 1,
      employeeId: 1,
      services: [{ serviceId: 1, durationMin: 30 }],
      scheduledAt: iso,
    }) as any;

  it('rejects CUSTOMER booking at now + 90 minutes with the exact 400 message', async () => {
    const scheduledAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();

    await expect(
      service.create(dtoAt(scheduledAt), { id: 9, role: 'CUSTOMER' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    try {
      await service.create(dtoAt(scheduledAt), { id: 9, role: 'CUSTOMER' });
      throw new Error('expected lead-time rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).message).toBe(LEAD_TIME_FA);
      expect((err as BadRequestException).getStatus()).toBe(400);
    }

    expect(mockPrisma.customer.findUnique).not.toHaveBeenCalled();
  });

  it('lets CUSTOMER booking at now + 130 minutes past lead-time validation', async () => {
    const scheduledAt = new Date(Date.now() + 130 * 60 * 1000).toISOString();

    await expect(
      service.create(dtoAt(scheduledAt), { id: 9, role: 'CUSTOMER' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      service.create(dtoAt(scheduledAt), { id: 9, role: 'CUSTOMER' }),
    ).rejects.not.toThrow(LEAD_TIME_FA);

    expect(mockPrisma.customer.findUnique).toHaveBeenCalled();
  });

  it('lets ADMIN skip the 2h rule at now + 90 minutes', async () => {
    const scheduledAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();

    await expect(
      service.create(dtoAt(scheduledAt), { id: 1, role: 'ADMIN' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockPrisma.customer.findUnique).toHaveBeenCalled();
  });

  it('lets EMPLOYEE skip the 2h rule at now + 90 minutes', async () => {
    mockPrisma.employee.findUnique.mockResolvedValue({ id: 1, userId: 2 });
    const scheduledAt = new Date(Date.now() + 90 * 60 * 1000).toISOString();

    await expect(
      service.create(dtoAt(scheduledAt), { id: 2, role: 'EMPLOYEE' }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(mockPrisma.employee.findUnique).toHaveBeenCalled();
    expect(mockPrisma.customer.findUnique).toHaveBeenCalled();
  });
});
