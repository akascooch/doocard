import { BadRequestException } from '@nestjs/common';
import { CustomerPackageStatus } from '@prisma/client';
import { PackagesService } from './packages.service';

describe('PackagesService', () => {
  const prisma = {
    service: { findUnique: jest.fn() },
    servicePackageTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    customer: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    employee: { findUnique: jest.fn() },
    loyaltyPointTransaction: { aggregate: jest.fn() },
    customerServicePackage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    customerPackageConsumption: { create: jest.fn(), findMany: jest.fn() },
    customerWalletLedger: { aggregate: jest.fn(), create: jest.fn() },
    appointment: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new PackagesService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
  });

  it('refuses consume when remainingSessions is 0', async () => {
    prisma.customerServicePackage.findUnique.mockResolvedValue({
      id: 'p1',
      customerId: 7,
      status: CustomerPackageStatus.ACTIVE,
      totalSessions: 5,
      remainingSessions: 0,
      expiresAt: new Date(Date.now() + 86400000),
      template: { serviceId: 3, title: 'رنگ', templateServices: [{ serviceId: 3 }] },
    });
    prisma.appointment.findFirst.mockResolvedValue({
      id: 11,
      customerId: 7,
      serviceId: 3,
      appointmentServices: [],
    });
    prisma.customerServicePackage.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.consumePackageSession('p1', { appointmentId: 11 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.customerPackageConsumption.create).not.toHaveBeenCalled();
  });

  it('decrements remainingSessions once and blocks a second consume of the same remaining=1', async () => {
    const owned = {
      id: 'p1',
      customerId: 7,
      status: CustomerPackageStatus.ACTIVE,
      totalSessions: 5,
      remainingSessions: 1,
      expiresAt: new Date(Date.now() + 86400000),
      template: { serviceId: 3, title: 'رنگ', templateServices: [{ serviceId: 3 }] },
    };
    prisma.appointment.findFirst.mockResolvedValue({
      id: 11,
      customerId: 7,
      serviceId: 3,
      appointmentServices: [],
    });
    prisma.customerServicePackage.findUnique
      .mockResolvedValueOnce(owned)
      .mockResolvedValueOnce({ ...owned, remainingSessions: 0 })
      .mockResolvedValueOnce({
        ...owned,
        remainingSessions: 0,
        status: CustomerPackageStatus.EXHAUSTED,
        template: { title: 'رنگ', service: { name: 'رنگ' } },
      })
      .mockResolvedValueOnce({ ...owned, remainingSessions: 0, status: CustomerPackageStatus.EXHAUSTED, template: { serviceId: 3 } });
    prisma.customerServicePackage.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    prisma.customerPackageConsumption.create.mockResolvedValue({});
    prisma.customerServicePackage.update.mockResolvedValue({});

    const first = await service.consumePackageSession('p1', { appointmentId: 11 });
    expect(first.remainingSessions).toBe(0);
    await expect(service.consumePackageSession('p1', { appointmentId: 12 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.customerPackageConsumption.create).toHaveBeenCalledTimes(1);
  });

  it('does not write salon transaction tables when assigning a cash package', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 7 });
    prisma.servicePackageTemplate.findFirst.mockResolvedValue({
      id: 't1',
      isActive: true,
      archivedAt: null,
      validityDays: 30,
      totalSessions: 5,
      priceRial: 1000n,
      serviceId: 3,
      templateServices: [{ serviceId: 3, service: { id: 3, name: 'رنگ' } }],
    });
    prisma.customerServicePackage.create.mockResolvedValue({
      id: 'p1',
      customerId: 7,
      packageTemplateId: 't1',
      totalSessions: 5,
      remainingSessions: 5,
      expiresAt: new Date(),
      status: 'ACTIVE',
      paymentMethod: 'CASH',
      notes: null,
      createdAt: new Date(),
      template: { title: 'رنگ', service: { name: 'رنگ' } },
    });
    await service.assignPackage({
      customerId: 7,
      packageTemplateId: 't1',
      paymentMethod: 'CASH',
    });
    expect(prisma.customerWalletLedger.create).not.toHaveBeenCalled();
  });

  it('disables package-catalog loyalty eligibility (unified appointment points rule)', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 7 });
    await expect(service.loyaltyEligibleForCustomer(7)).resolves.toEqual({
      customerId: 7,
      points: 0,
      items: [],
    });
    expect(prisma.loyaltyPointTransaction.aggregate).not.toHaveBeenCalled();
  });

  it('rejects wallet assign when store-credit is insufficient', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 7 });
    prisma.servicePackageTemplate.findFirst.mockResolvedValue({
      id: 't1',
      isActive: true,
      archivedAt: null,
      validityDays: 30,
      totalSessions: 5,
      priceRial: 5000n,
      serviceId: 3,
      templateServices: [{ serviceId: 3 }],
    });
    prisma.customerWalletLedger.aggregate.mockResolvedValue({ _sum: { amount: 100n } });
    await expect(
      service.assignPackage({ customerId: 7, packageTemplateId: 't1', paymentMethod: 'WALLET' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.customerServicePackage.create).not.toHaveBeenCalled();
  });

  it('keeps an unlimited package active after consume and does not decrement', async () => {
    const owned = {
      id: 'p-unlim',
      customerId: 7,
      status: CustomerPackageStatus.ACTIVE,
      totalSessions: 0,
      remainingSessions: 0,
      expiresAt: new Date(Date.now() + 86400000),
      template: { serviceId: 3, title: 'نامحدود', templateServices: [{ serviceId: 3, service: { name: 'اصلاح' } }] },
    };
    prisma.customerServicePackage.findUnique.mockResolvedValue(owned);
    prisma.appointment.findFirst.mockResolvedValue({
      id: 21,
      customerId: 7,
      serviceId: 3,
      appointmentServices: [{ serviceId: 3 }, { serviceId: 8 }],
      status: 'SETTLED',
      deletedAt: null,
    });
    prisma.customerPackageConsumption.create.mockResolvedValue({ id: 'c1' });

    const result = await service.consumePackageSession('p-unlim', { appointmentId: 21 });

    expect(prisma.customerServicePackage.updateMany).not.toHaveBeenCalled();
    expect(result.unlimited).toBe(true);
    expect(result.status).toBe(CustomerPackageStatus.ACTIVE);
    expect(result.remainingSessions).toBe(0);
  });

  it('lists only the barber preferred customers who hold an active package', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 9, isActive: true });
    prisma.customer.count.mockResolvedValue(1);
    prisma.customer.findMany.mockResolvedValue([]);

    await service.listVisibleActiveHolders({ id: 9, role: 'EMPLOYEE' }, 1, 20);

    const where = prisma.customer.findMany.mock.calls[0][0].where;
    expect(where.preferredEmployeeId).toBe(4);
    expect(where.OR).toBeUndefined();
    expect(where.servicePackages.some.OR).toEqual([
      { totalSessions: 0 },
      { remainingSessions: { gt: 0 } },
    ]);
  });

  it('history excludes cancelled and deleted appointments', async () => {
    prisma.employee.findUnique.mockResolvedValue({ id: 4, userId: 9, isActive: true });
    prisma.customer.findFirst.mockResolvedValue({ id: 7 });
    prisma.customerPackageConsumption.findMany.mockResolvedValue([]);

    await service.listVisiblePackageHistory({ id: 9, role: 'EMPLOYEE' }, 7);

    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 7, preferredEmployeeId: 4 }),
      }),
    );
    expect(prisma.customerPackageConsumption.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerPackage: { customerId: 7 },
          appointment: { deletedAt: null, status: { not: 'CANCELLED' } },
        },
      }),
    );
  });
});
