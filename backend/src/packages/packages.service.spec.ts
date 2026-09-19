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
    customer: { findUnique: jest.fn() },
    loyaltyPointTransaction: { aggregate: jest.fn() },
    customerServicePackage: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    customerPackageConsumption: { create: jest.fn() },
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
      remainingSessions: 0,
      expiresAt: new Date(Date.now() + 86400000),
      template: { serviceId: 3, title: 'رنگ' },
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
      remainingSessions: 1,
      expiresAt: new Date(Date.now() + 86400000),
      template: { serviceId: 3, title: 'رنگ' },
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

  it('returns no loyalty packages when points are below threshold', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 7 });
    prisma.loyaltyPointTransaction.aggregate.mockResolvedValue({ _sum: { points: 40 } });
    prisma.servicePackageTemplate.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'رنگ',
        description: null,
        priceRial: 5000n,
        validityDays: 30,
        totalSessions: 5,
        serviceId: 3,
        pointsRequired: 100,
        isActive: true,
        archivedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        service: { id: 3, name: 'رنگ' },
      },
    ]);
    await expect(service.loyaltyEligibleForCustomer(7)).resolves.toEqual({
      customerId: 7,
      points: 40,
      items: [],
    });
  });

  it('returns qualifying packages when points meet or exceed threshold', async () => {
    prisma.customer.findUnique.mockResolvedValue({ id: 7 });
    prisma.loyaltyPointTransaction.aggregate.mockResolvedValue({ _sum: { points: 120 } });
    prisma.servicePackageTemplate.findMany.mockResolvedValue([
      {
        id: 't1',
        title: 'رنگ',
        description: null,
        priceRial: 5000n,
        validityDays: 30,
        totalSessions: 5,
        serviceId: 3,
        pointsRequired: 100,
        isActive: true,
        archivedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        service: { id: 3, name: 'رنگ' },
      },
      {
        id: 't2',
        title: 'کراتین',
        description: null,
        priceRial: 9000n,
        validityDays: 30,
        totalSessions: 3,
        serviceId: 4,
        pointsRequired: 200,
        isActive: true,
        archivedAt: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        service: { id: 4, name: 'کراتین' },
      },
    ]);
    const result = await service.loyaltyEligibleForCustomer(7);
    expect(result.points).toBe(120);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 't1',
      title: 'رنگ',
      pointsRequired: 100,
      qualified: true,
    });
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
    });
    prisma.customerWalletLedger.aggregate.mockResolvedValue({ _sum: { amount: 100n } });
    await expect(
      service.assignPackage({ customerId: 7, packageTemplateId: 't1', paymentMethod: 'WALLET' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.customerServicePackage.create).not.toHaveBeenCalled();
  });
});
