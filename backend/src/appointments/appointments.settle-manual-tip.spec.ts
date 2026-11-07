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
import { PackagesService } from '../packages/packages.service';
import { flushFireAndForgetAfterEach } from '../../test/flush-fire-and-forget';

describe('AppointmentsService.settle manual tip ledger', () => {
  flushFireAndForgetAfterEach();

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

  async function build(role: 'SERVICE' | 'EMPLOYEE') {
    const ledger: {
      income: unknown[]
      manualTips: unknown[]
      tipSources: unknown[]
      bankIncrements: bigint[]
    } = { income: [], manualTips: [], tipSources: [], bankIncrements: [] };

    const makeTx = () => ({
      $queryRaw: jest.fn(async () => [{ id: 41 }]),
      appointment: {
        findUnique: jest.fn(async () => ({ ...appointmentRow })),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...appointmentRow,
          ...data,
          customer: appointmentRow.customer,
          employee: appointmentRow.employee,
        })),
      },
      transaction: {
        findFirst: jest.fn(async (args: { where?: { sourceType?: string } }) => {
          if (args?.where?.sourceType === 'MANUAL_TIP') {
            return ledger.manualTips.length ? { id: 2 } : null;
          }
          if (args?.where?.sourceType === 'APPOINTMENT') {
            return ledger.income.length ? { id: 1 } : null;
          }
          return null;
        }),
        create: jest.fn(async ({ data }: { data: { sourceType: string } }) => {
          if (data.sourceType === 'MANUAL_TIP') ledger.manualTips.push(data);
          else ledger.income.push(data);
          return { id: ledger.income.length + ledger.manualTips.length };
        }),
      },
      customerDebt: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
      bankAccount: {
        update: jest.fn(async ({ data }: { data: { balance: { increment: bigint } } }) => {
          ledger.bankIncrements.push(data.balance.increment);
          return { id: 12 };
        }),
      },
      appointmentTipAllocation: { createMany: jest.fn() },
      tipSource: {
        findUnique: jest.fn(async () => (ledger.tipSources.length ? { id: 9 } : null)),
        create: jest.fn(async ({ data }: { data: unknown }) => {
          ledger.tipSources.push(data);
          return { id: 9, ...((data as object) || {}) };
        }),
      },
    });

    const prisma = {
      appointment: {
        findFirst: jest.fn(async () => ({ ...appointmentRow, status: 'CONFIRMED' })),
      },
      transaction: { findFirst: jest.fn().mockResolvedValue(null) },
      customerDebt: {
        findFirst: jest.fn().mockResolvedValue(null),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: 8,
          isActive: true,
          user: { role },
        }),
      },
      appointmentTipAllocation: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (tx: ReturnType<typeof makeTx>) => Promise<unknown>) =>
        fn(makeTx()),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingService, useValue: {} },
        { provide: NotificationsService, useValue: { create: jest.fn().mockResolvedValue({ id: 1 }) } },
        { provide: NotificationsGateway, useValue: { sendToUser: jest.fn(), sendToRole: jest.fn() } },
        { provide: PushNotificationsService, useValue: { sendToUser: jest.fn() } },
        { provide: CalendarService, useValue: {} },
        { provide: SmsOutboundService, useValue: { sendIfAllowed: jest.fn() } },
        { provide: SmsTemplateService, useValue: { getByKey: jest.fn(), renderByKey: jest.fn() } },
        { provide: TipAlertService, useValue: { notifyTipRecipients: jest.fn() } },
        { provide: PackagesService, useValue: {} },
      ],
    }).compile();

    return { service: module.get(AppointmentsService), ledger, prisma };
  }

  const dto = {
    amount: 500000,
    paymentMethod: 'CASH' as const,
    accountId: 12,
    manualTipAmount: 50000,
    manualTipRecipientEmployeeId: 8,
  };

  it('SERVICE recipient books MANUAL_TIP, bank increment, TipSource, and allocation', async () => {
    const { service, ledger } = await build('SERVICE');
    await service.settle(41, dto as never, admin);

    expect(ledger.income).toHaveLength(1);
    expect(ledger.manualTips).toHaveLength(1);
    expect(ledger.manualTips[0]).toEqual(
      expect.objectContaining({ sourceType: 'MANUAL_TIP', amount: 50000n, employeeId: 8 }),
    );
    expect(ledger.tipSources).toHaveLength(1);
    expect(ledger.tipSources[0]).toEqual(
      expect.objectContaining({
        idempotencyKey: 'settle-manual-tip:41',
        recipientEmployeeId: 8,
        amountRial: 50000n,
      }),
    );
    expect((ledger.tipSources[0] as { allocations: { create: unknown[] } }).allocations.create).toEqual([
      { employeeId: 8, amountRial: 50000n },
    ]);
    expect(ledger.bankIncrements).toEqual([500000n, 50000n]);
  });

  it('EMPLOYEE recipient books MANUAL_TIP only (no TipSource)', async () => {
    const { service, ledger } = await build('EMPLOYEE');
    await service.settle(41, dto as never, admin);
    expect(ledger.manualTips).toHaveLength(1);
    expect(ledger.tipSources).toHaveLength(0);
    expect(ledger.bankIncrements).toEqual([500000n, 50000n]);
  });
});
