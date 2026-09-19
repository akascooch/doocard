import * as fs from 'fs';
import * as path from 'path';
import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Localhost-only PostgreSQL proof that SELECT … FOR UPDATE serializes settle().
 * Skips when DATABASE_URL is missing or not loopback. Never prints the URL.
 */
function localhostDatabaseUrl(): string | null {
  const fromEnv = process.env.DATABASE_URL || readDotEnvDatabaseUrl();
  if (!fromEnv) return null;
  if (!/@localhost[:/]/i.test(fromEnv) && !/@127\.0\.0\.1[:/]/.test(fromEnv)) {
    return null;
  }
  return fromEnv;
}

function readDotEnvDatabaseUrl(): string | null {
  const envPath = path.join(__dirname, '../../.env');
  try {
    const text = fs.readFileSync(envPath, 'utf8');
    const match = text.match(/^DATABASE_URL\s*=\s*(.+)$/m);
    if (!match) return null;
    let raw = match[1].trim();
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      raw = raw.slice(1, -1);
    }
    return raw;
  } catch {
    return null;
  }
}

const localUrl = localhostDatabaseUrl();

(localUrl ? describe : describe.skip)('AppointmentsService.settle PostgreSQL FOR UPDATE', () => {
  let prisma: PrismaClient;
  let service: AppointmentsService;
  let notificationsCreate: jest.Mock;
  let smsSendIfAllowed: jest.Mock;

  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`.slice(-11);
  const phones = {
    customer: `0911${stamp.slice(0, 7)}`,
    barber: `0912${stamp.slice(0, 7)}`,
    admin: `0913${stamp.slice(0, 7)}`,
  };

  let ids: {
    customerUserId: number;
    barberUserId: number;
    adminUserId: number;
    customerId: number;
    employeeId: number;
    appointmentId: number;
    productId: number;
    bankAccountId: number;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = localUrl as string;
    prisma = new PrismaClient();
    await prisma.$connect();

    notificationsCreate = jest.fn().mockResolvedValue({ id: 1 });
    smsSendIfAllowed = jest.fn().mockResolvedValue({ success: true });

    service = new AppointmentsService(
      prisma as unknown as PrismaService,
      {} as never,
      { create: notificationsCreate } as never,
      { sendToUser: jest.fn(), sendToRole: jest.fn() } as never,
      { sendToUser: jest.fn().mockResolvedValue({ sent: 0, failed: 0 }) } as never,
      {} as never,
      { sendIfAllowed: smsSendIfAllowed } as never,
      {} as never,
      { notifyTipRecipients: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  afterAll(async () => {
    if (ids) {
      await cleanup();
    }
    await prisma.$disconnect();
  });

  async function cleanup() {
    if (!ids) return;
    await prisma.inventoryMovement.deleteMany({
      where: { OR: [{ productId: ids.productId }, { referenceId: ids.appointmentId }] },
    });
    await prisma.appointmentProduct.deleteMany({ where: { appointmentId: ids.appointmentId } });
    await prisma.transaction.deleteMany({
      where: { OR: [{ sourceId: ids.appointmentId }, { accountId: ids.bankAccountId }] },
    });
    await prisma.customerDebt.deleteMany({ where: { appointmentId: ids.appointmentId } });
    await prisma.appointmentTipAllocation.deleteMany({ where: { appointmentId: ids.appointmentId } });
    await prisma.loyaltyPointTransaction.deleteMany({ where: { customerId: ids.customerId } });
    await prisma.customerPackageConsumption.deleteMany({
      where: { appointmentId: ids.appointmentId },
    });
    await prisma.appointment.deleteMany({ where: { id: ids.appointmentId } });
    await prisma.product.deleteMany({ where: { id: ids.productId } });
    await prisma.bankAccount.deleteMany({ where: { id: ids.bankAccountId } });
    await prisma.customer.deleteMany({ where: { id: ids.customerId } });
    await prisma.employee.deleteMany({ where: { id: ids.employeeId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ids.customerUserId, ids.barberUserId, ids.adminUserId] } },
    });
  }

  async function seedConfirmedAppointment() {
    await cleanup().catch(() => undefined);

    const customerUser = await prisma.user.create({
      data: {
        name: `settle-lock-c-${stamp}`,
        phone: phones.customer,
        email: `settle-lock-c-${stamp}@local.test`,
        password: 'hashed',
        role: 'CUSTOMER',
      },
    });
    const barberUser = await prisma.user.create({
      data: {
        name: `settle-lock-b-${stamp}`,
        phone: phones.barber,
        email: `settle-lock-b-${stamp}@local.test`,
        password: 'hashed',
        role: 'EMPLOYEE',
      },
    });
    const adminUser = await prisma.user.create({
      data: {
        name: `settle-lock-a-${stamp}`,
        phone: phones.admin,
        email: `settle-lock-a-${stamp}@local.test`,
        password: 'hashed',
        role: 'ADMIN',
      },
    });
    const customer = await prisma.customer.create({ data: { userId: customerUser.id } });
    const employee = await prisma.employee.create({
      data: { userId: barberUser.id, specialty: 'lock-test' },
    });
    const bank = await prisma.bankAccount.create({
      data: { name: `settle-lock-${stamp}`, balance: 0n },
    });
    const product = await prisma.product.create({
      data: {
        name: `settle-lock-gel-${stamp}`,
        sku: `SLK-${stamp}`,
        priceRial: 10000n,
        stock: 10,
        isActive: true,
      },
    });
    const appointment = await prisma.appointment.create({
      data: {
        customerId: customer.id,
        employeeId: employee.id,
        status: 'CONFIRMED',
        scheduledAt: new Date('2030-01-15T10:00:00Z'),
        durationMin: 30,
        services: [
          { serviceId: 1, priceAtBooking: 500000, durationMin: 30, serviceName: 'LockTest' },
        ],
      },
    });

    ids = {
      customerUserId: customerUser.id,
      barberUserId: barberUser.id,
      adminUserId: adminUser.id,
      customerId: customer.id,
      employeeId: employee.id,
      appointmentId: appointment.id,
      productId: product.id,
      bankAccountId: bank.id,
    };
  }

  it('settles once against PostgreSQL and deducts inventory once', async () => {
    await seedConfirmedAppointment();
    const admin = { id: ids.adminUserId, sub: ids.adminUserId, role: 'ADMIN' };

    const result = await service.settle(
      ids.appointmentId,
      {
        amount: 500000,
        paymentMethod: 'CASH',
        accountId: ids.bankAccountId,
        items: [{ productId: ids.productId, quantity: 2 }],
      } as any,
      admin,
    );

    expect(result.status).toBe('SETTLED');
    const appt = await prisma.appointment.findUnique({ where: { id: ids.appointmentId } });
    expect(appt?.status).toBe('SETTLED');
    const incomes = await prisma.transaction.count({
      where: { sourceType: 'APPOINTMENT', sourceId: ids.appointmentId, type: 'INCOME', deletedAt: null },
    });
    expect(incomes).toBe(1);
    const product = await prisma.product.findUnique({ where: { id: ids.productId } });
    expect(product?.stock).toBe(8);
    const movements = await prisma.inventoryMovement.count({
      where: { referenceType: 'APPOINTMENT', referenceId: ids.appointmentId },
    });
    expect(movements).toBe(1);
  });

  it('rejects a second sequential settle with ConflictException and no extra writes', async () => {
    await seedConfirmedAppointment();
    const admin = { id: ids.adminUserId, sub: ids.adminUserId, role: 'ADMIN' };
    const dto = {
      amount: 500000,
      paymentMethod: 'CASH',
      accountId: ids.bankAccountId,
      items: [{ productId: ids.productId, quantity: 2 }],
    } as any;

    await service.settle(ids.appointmentId, dto, admin);
    notificationsCreate.mockClear();

    await expect(service.settle(ids.appointmentId, dto, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const incomes = await prisma.transaction.count({
      where: { sourceType: 'APPOINTMENT', sourceId: ids.appointmentId, type: 'INCOME', deletedAt: null },
    });
    expect(incomes).toBe(1);
    const product = await prisma.product.findUnique({ where: { id: ids.productId } });
    expect(product?.stock).toBe(8);
    const loyalty = await prisma.loyaltyPointTransaction.count({
      where: { customerId: ids.customerId },
    });
    expect(loyalty).toBe(0);
    const packages = await prisma.customerPackageConsumption.count({
      where: { appointmentId: ids.appointmentId },
    });
    expect(packages).toBe(0);
    expect(notificationsCreate).not.toHaveBeenCalled();
    expect(smsSendIfAllowed).not.toHaveBeenCalled();
  });

  it('allows only one of two concurrent PostgreSQL settlements to commit', async () => {
    await seedConfirmedAppointment();
    const admin = { id: ids.adminUserId, sub: ids.adminUserId, role: 'ADMIN' };
    const dto = {
      amount: 500000,
      paymentMethod: 'CASH',
      accountId: ids.bankAccountId,
      items: [{ productId: ids.productId, quantity: 2 }],
    } as any;

    const results = await Promise.allSettled([
      service.settle(ids.appointmentId, dto, admin),
      service.settle(ids.appointmentId, dto, admin),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    const incomes = await prisma.transaction.count({
      where: { sourceType: 'APPOINTMENT', sourceId: ids.appointmentId, type: 'INCOME', deletedAt: null },
    });
    expect(incomes).toBe(1);
    const product = await prisma.product.findUnique({ where: { id: ids.productId } });
    expect(product?.stock).toBe(8);
    const movements = await prisma.inventoryMovement.count({
      where: { referenceType: 'APPOINTMENT', referenceId: ids.appointmentId },
    });
    expect(movements).toBe(1);
    const bank = await prisma.bankAccount.findUnique({ where: { id: ids.bankAccountId } });
    expect(bank?.balance).toBe(500000n);
    const loyalty = await prisma.loyaltyPointTransaction.count({
      where: { customerId: ids.customerId },
    });
    expect(loyalty).toBe(0);
    expect(notificationsCreate).toHaveBeenCalledTimes(2);
    expect(smsSendIfAllowed).not.toHaveBeenCalled();
  });
});
