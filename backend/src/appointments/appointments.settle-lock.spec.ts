import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
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

describe('AppointmentsService.settle row lock (C1)', () => {
  const appointmentRow = {
    id: 41,
    customerId: 7,
    employeeId: 3,
    status: 'CONFIRMED',
    services: [{ serviceId: 1, priceAtBooking: 500000, durationMin: 30, serviceName: 'Haircut' }],
    scheduledAt: new Date('2024-01-15T10:00:00Z'),
    durationMin: 30,
    amount: null,
    notes: null,
    financiallyLockedAt: null,
    deletedAt: null,
    customer: {
      id: 7,
      userId: 70,
      user: { id: 70, name: 'Customer', email: 'c@example.com', phone: '09120000001', role: 'CUSTOMER' },
    },
    employee: {
      id: 3,
      userId: 30,
      user: { id: 30, name: 'Barber', email: 'b@example.com', phone: '09120000002', role: 'EMPLOYEE' },
    },
    transactions: [],
  };

  const admin = { id: 99, sub: 99, role: 'ADMIN' };
  const settleDto = {
    amount: 500000,
    paymentMethod: 'CASH' as const,
    accountId: 12,
  };

  let service: AppointmentsService;
  let prisma: ReturnType<typeof createPrismaHarness>['prisma'];
  let harness: ReturnType<typeof createPrismaHarness>;
  let notificationsService: { create: jest.Mock };
  let smsOutbound: { sendIfAllowed: jest.Mock };

  function createPrismaHarness() {
    const rowState = {
      status: 'CONFIRMED' as string,
      financiallyLockedAt: null as Date | null,
      deletedAt: null as Date | null,
    };
    const callOrder: string[] = [];
    let lockHeld = false;
    const lockWaiters: Array<() => void> = [];
    const sideEffects = {
      appointmentUpdates: 0,
      incomeCreates: 0,
      inventoryCreates: 0,
      productDecrements: 0,
    };

    const makeTx = () => {
      const tx = {
        $queryRaw: jest.fn(async (strings: TemplateStringsArray, id: number) => {
          const sql = Array.from(strings).join('?');
          callOrder.push('FOR UPDATE');
          expect(sql).toContain('FOR UPDATE');
          expect(sql).toContain('"appointments"');
          expect(id).toBe(appointmentRow.id);
          if (lockHeld) {
            await new Promise<void>((resolve) => lockWaiters.push(resolve));
          }
          lockHeld = true;
          return [{ id: appointmentRow.id }];
        }),
        $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
          const sql = Array.from(strings).join('?');
          if (sql.includes('stock')) {
            sideEffects.productDecrements += 1;
          }
          return 1;
        }),
        appointment: {
          findUnique: jest.fn(async () => {
            callOrder.push('findUnique');
            return {
              ...appointmentRow,
              status: rowState.status,
              financiallyLockedAt: rowState.financiallyLockedAt,
              deletedAt: rowState.deletedAt,
            };
          }),
          update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
            sideEffects.appointmentUpdates += 1;
            rowState.status = String(data.status ?? rowState.status);
            return {
              ...appointmentRow,
              ...data,
              status: rowState.status,
              customer: appointmentRow.customer,
              employee: appointmentRow.employee,
            };
          }),
        },
        transaction: {
          findFirst: jest.fn(async () =>
            sideEffects.incomeCreates > 0
              ? { id: 1, sourceType: 'APPOINTMENT', sourceId: appointmentRow.id, type: 'INCOME' }
              : null,
          ),
          create: jest.fn(async () => {
            sideEffects.incomeCreates += 1;
            return { id: sideEffects.incomeCreates };
          }),
        },
        customerDebt: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
        },
        bankAccount: {
          update: jest.fn().mockResolvedValue({ id: 12, balance: 500000n }),
        },
        appointmentTipAllocation: {
          createMany: jest.fn(),
        },
        product: {
          findUnique: jest.fn().mockResolvedValue({
            id: 5,
            name: 'Gel',
            isActive: true,
            stock: 10,
            priceRial: 10000n,
          }),
        },
        appointmentProduct: {
          create: jest.fn(),
        },
        inventoryMovement: {
          create: jest.fn(async () => {
            sideEffects.inventoryCreates += 1;
            return { id: sideEffects.inventoryCreates };
          }),
        },
      };
      return tx;
    };

    const prismaMock = {
      appointment: {
        findFirst: jest.fn(async () => ({ ...appointmentRow, status: 'CONFIRMED' })),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      transaction: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      customerDebt: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      appointmentTipAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) => {
        const tx = makeTx();
        try {
          return await fn(tx);
        } finally {
          lockHeld = false;
          const next = lockWaiters.shift();
          next?.();
        }
      }),
    };

    return { prisma: prismaMock, rowState, callOrder, sideEffects };
  }

  beforeEach(async () => {
    harness = createPrismaHarness();
    prisma = harness.prisma;
    notificationsService = { create: jest.fn().mockResolvedValue({ id: 1 }) };
    smsOutbound = { sendIfAllowed: jest.fn().mockResolvedValue({ success: true }) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingService, useValue: {} },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: NotificationsGateway, useValue: { sendToUser: jest.fn(), sendToRole: jest.fn() } },
        {
          provide: PushNotificationsService,
          useValue: { sendToUser: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }) },
        },
        { provide: CalendarService, useValue: {} },
        { provide: SmsOutboundService, useValue: smsOutbound },
        { provide: SmsTemplateService, useValue: { getByKey: jest.fn(), renderByKey: jest.fn() } },
        { provide: TipAlertService, useValue: { notifyTipRecipients: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
  });

  it('settles a PENDING/CONFIRMED appointment once and writes ledger once', async () => {
    const result = await service.settle(41, settleDto as any, admin);

    expect(result.status).toBe('SETTLED');
    expect(harness.callOrder[0]).toBe('FOR UPDATE');
    expect(harness.callOrder[1]).toBe('findUnique');
    expect(harness.sideEffects.appointmentUpdates).toBe(1);
    expect(harness.sideEffects.incomeCreates).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('rejects an already-settled appointment before opening a write transaction', async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      ...appointmentRow,
      status: 'SETTLED',
    });

    await expect(service.settle(41, settleDto as any, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(harness.sideEffects.incomeCreates).toBe(0);
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it('after FOR UPDATE, a SETTLED row is rejected with no side effects', async () => {
    prisma.appointment.findFirst.mockResolvedValue({ ...appointmentRow, status: 'CONFIRMED' });
    harness.rowState.status = 'SETTLED';

    await expect(service.settle(41, settleDto as any, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.callOrder[0]).toBe('FOR UPDATE');
    expect(harness.callOrder[1]).toBe('findUnique');
    expect(harness.sideEffects.appointmentUpdates).toBe(0);
    expect(harness.sideEffects.incomeCreates).toBe(0);
    expect(notificationsService.create).not.toHaveBeenCalled();
  });

  it('serializes two concurrent settles: one wins, the other sees SETTLED, side effects run once', async () => {
    const dtoWithItem = {
      ...settleDto,
      items: [{ productId: 5, quantity: 2 }],
    };

    const results = await Promise.allSettled([
      service.settle(41, dtoWithItem as any, admin),
      service.settle(41, dtoWithItem as any, admin),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].status).toBe('rejected');
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    expect(harness.sideEffects.appointmentUpdates).toBe(1);
    expect(harness.sideEffects.incomeCreates).toBe(1);
    expect(harness.sideEffects.inventoryCreates).toBe(1);
    expect(harness.sideEffects.productDecrements).toBe(1);
    expect(notificationsService.create).toHaveBeenCalledTimes(2);
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    expect(harness.callOrder.filter((s) => s === 'FOR UPDATE')).toHaveLength(2);
  });
});
