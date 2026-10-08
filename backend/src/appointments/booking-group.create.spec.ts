import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
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

describe('multi-barber booking group', () => {
  const prisma: any = {
    appointment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    customer: { findUnique: jest.fn(), updateMany: jest.fn() },
    employee: { findUnique: jest.fn() },
    service: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const notifications = { create: jest.fn().mockResolvedValue({ id: 1 }) };
  let service: AppointmentsService;

  const dto = {
    customerId: 1,
    jalaliDate: '1408-10-11',
    time: '11:00',
    clientOpId: 'group-key',
    selections: [
      { serviceId: 1, employeeId: 1 },
      { serviceId: 2, employeeId: 2 },
    ],
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingService, useValue: {} },
        { provide: NotificationsService, useValue: notifications },
        { provide: NotificationsGateway, useValue: { sendToRole: jest.fn(), sendToUser: jest.fn() } },
        { provide: PushNotificationsService, useValue: { sendToRole: jest.fn() } },
        {
          provide: CalendarService,
          useValue: {
            toGregorian: jest.fn().mockReturnValue(new Date(Date.UTC(2030, 0, 1))),
            ensureExists: jest.fn().mockResolvedValue({ id: 4 }),
          },
        },
        { provide: SmsOutboundService, useValue: { sendIfAllowed: jest.fn() } },
        { provide: SmsTemplateService, useValue: { renderByKey: jest.fn().mockResolvedValue('sms') } },
        { provide: TipAlertService, useValue: { notify: jest.fn() } },
      ],
    }).compile();
    service = module.get(AppointmentsService);
    prisma.customer.findUnique.mockResolvedValue({
      id: 1,
      user: { id: 3, name: 'Cust', role: 'CUSTOMER' },
    });
    prisma.customer.updateMany.mockResolvedValue({ count: 0 });
    prisma.employee.findUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({
      id: where.id,
      isActive: true,
      user: { id: 20 + where.id, role: 'EMPLOYEE', name: 'Barber' },
      employeeServices: [{ serviceId: where.id }],
    }));
    prisma.service.findUnique.mockImplementation(async ({ where }: { where: { id: number } }) => ({
      id: where.id,
      name: where.id === 1 ? 'Cut' : 'Color',
      price: where.id === 1 ? 30_000_000 : 10_000_000,
      durationMinutes: 30,
    }));
  });

  it('returns the same appointments for a repeated client group key and does not create again', async () => {
    const rows = [
      { id: 10, bookingGroupId: 'group-key', customerId: 1, employeeId: 1, services: [], durationMin: 30, scheduledAt: new Date() },
      { id: 11, bookingGroupId: 'group-key', customerId: 1, employeeId: 2, services: [], durationMin: 30, scheduledAt: new Date() },
    ];
    prisma.appointment.findUnique.mockResolvedValue(rows[0]);
    prisma.appointment.findMany.mockResolvedValue(rows);

    const result = await service.create(dto as any, { id: 1, role: 'ADMIN' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
    expect(result.bookingGroupId).toBe('group-key');
    expect(result.appointments.map((row: { id: number }) => row.id)).toEqual([10, 11]);
  });

  it('creates one full-price appointment per pair inside a single transaction', async () => {
    prisma.appointment.findUnique.mockResolvedValue(null);
    prisma.appointment.findMany.mockResolvedValue([]);
    const created: any[] = [];
    prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        $executeRaw: jest.fn(),
        appointment: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(async ({ data }: { data: any }) => {
            const row = { id: created.length + 1, ...data, customer: { user: { name: 'Cust' } }, employee: { user: { name: 'Barber' } } };
            created.push(data);
            return row;
          }),
        },
        blockedTime: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      return fn(tx);
    });

    const result = await service.create(dto as any, { id: 1, role: 'ADMIN' });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(2);
    expect(created[0].bookingGroupId).toBe('group-key');
    expect(created[1].bookingGroupId).toBe('group-key');
    expect(created[0].clientOpId).toBe('group-key');
    expect(created[1].clientOpId).toBeNull();
    expect(created[0].services[0].priceAtBooking).toBe(30_000_000);
    expect(created[1].services[0].priceAtBooking).toBe(10_000_000);
    expect(created[0].employeeId).toBe(1);
    expect(created[1].employeeId).toBe(2);
    expect(result.appointments).toHaveLength(2);
  });

  it('rolls the group back when the second insert fails', async () => {
    prisma.appointment.findUnique.mockResolvedValue(null);
    let calls = 0;
    prisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      const tx = {
        $executeRaw: jest.fn(),
        appointment: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(async () => {
            calls += 1;
            if (calls === 2) throw new Error('insert failed');
            return { id: 1 };
          }),
        },
        blockedTime: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      return fn(tx);
    });

    await expect(service.create(dto as any, { id: 1, role: 'ADMIN' })).rejects.toThrow('insert failed');
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('rejects two services for the same barber at the same time before writing', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 1,
      isActive: true,
      user: { role: 'EMPLOYEE' },
      employeeServices: [{ serviceId: 1 }, { serviceId: 2 }],
    });

    await expect(
      service.create(
        {
          ...dto,
          selections: [
            { serviceId: 1, employeeId: 1 },
            { serviceId: 2, employeeId: 1 },
          ],
        } as any,
        { id: 1, role: 'ADMIN' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
