import { BadRequestException } from '@nestjs/common';
import { CustomerPackageStatus } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PackagesService } from './packages.service';

describe('packages-loyalty-integration (v2.0.7)', () => {
  const prisma = {
    service: { findUnique: jest.fn() },
    servicePackageTemplate: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    customer: { findUnique: jest.fn() },
    customerServicePackage: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    customerPackageConsumption: { create: jest.fn() },
    customerWalletLedger: { aggregate: jest.fn(), create: jest.fn() },
    loyaltyPointTransaction: { aggregate: jest.fn(), create: jest.fn() },
    appointment: { findFirst: jest.fn() },
    systemSettings: { upsert: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  const packages = new PackagesService(prisma as never);
  const loyalty = new LoyaltyService(prisma as never);

  const templateRow = {
    id: 'tpl-1',
    title: 'رنگ ۵ جلسه',
    description: null,
    priceRial: 5_000_000n,
    validityDays: 90,
    totalSessions: 5,
    serviceId: 3,
    isActive: true,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    service: { id: 3, name: 'رنگ' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
    prisma.$queryRaw.mockResolvedValue([{ id: 7 }]);
    prisma.systemSettings.upsert.mockResolvedValue({
      loyaltyRateRialPerPoint: 2500,
      loyaltyMinRedeemPoints: 50,
    });
    prisma.customer.findUnique.mockResolvedValue({ id: 7, userId: 9 });
  });

  it('creates a template, assigns it, consumes one session atomically, then redeems points at the DB rate', async () => {
    prisma.service.findUnique.mockResolvedValue({ id: 3, name: 'رنگ' });
    prisma.servicePackageTemplate.create.mockResolvedValue(templateRow);

    const template = await packages.createTemplate({
      title: 'رنگ ۵ جلسه',
      priceRial: '5000000',
      validityDays: 90,
      totalSessions: 5,
      serviceId: 3,
    });
    expect(template).toMatchObject({ id: 'tpl-1', totalSessions: 5, serviceId: 3, priceRial: '5000000' });

    prisma.servicePackageTemplate.findFirst.mockResolvedValue(templateRow);
    prisma.customerServicePackage.create.mockResolvedValue({
      id: 'pkg-1',
      customerId: 7,
      packageTemplateId: 'tpl-1',
      totalSessions: 5,
      remainingSessions: 5,
      expiresAt: new Date(Date.now() + 90 * 86400000),
      status: CustomerPackageStatus.ACTIVE,
      paymentMethod: 'CASH',
      notes: null,
      createdAt: new Date(),
      template: { title: 'رنگ ۵ جلسه', serviceId: 3, service: { name: 'رنگ' } },
    });

    const assigned = await packages.assignPackage({
      customerId: 7,
      packageTemplateId: 'tpl-1',
      paymentMethod: 'CASH',
    });
    expect(assigned.remainingSessions).toBe(5);
    expect(prisma.customerWalletLedger.create).not.toHaveBeenCalled();

    const owned = {
      id: 'pkg-1',
      customerId: 7,
      status: CustomerPackageStatus.ACTIVE,
      remainingSessions: 5,
      expiresAt: new Date(Date.now() + 86400000),
      template: { serviceId: 3, title: 'رنگ ۵ جلسه' },
    };
    prisma.customerServicePackage.findUnique
      .mockResolvedValueOnce(owned)
      .mockResolvedValueOnce({ ...owned, remainingSessions: 4 })
      .mockResolvedValueOnce({
        ...owned,
        remainingSessions: 4,
        template: { title: 'رنگ ۵ جلسه', serviceId: 3, service: { name: 'رنگ' } },
      });
    prisma.appointment.findFirst.mockResolvedValue({
      id: 11,
      customerId: 7,
      serviceId: 3,
      appointmentServices: [],
    });
    prisma.customerServicePackage.updateMany.mockResolvedValue({ count: 1 });
    prisma.customerPackageConsumption.create.mockResolvedValue({ id: 'c1' });

    const consumed = await packages.consumePackageSession('pkg-1', { appointmentId: 11 });
    expect(consumed.remainingSessions).toBe(4);
    expect(prisma.customerServicePackage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'pkg-1',
          status: CustomerPackageStatus.ACTIVE,
          remainingSessions: { gt: 0 },
        }),
        data: { remainingSessions: { decrement: 1 } },
      }),
    );
    expect(prisma.customerPackageConsumption.create).toHaveBeenCalledWith({
      data: { customerPackageId: 'pkg-1', appointmentId: 11 },
    });

    prisma.loyaltyPointTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { points: 80 } })
      .mockResolvedValueOnce({ _sum: { points: 30 } });
    prisma.loyaltyPointTransaction.create.mockResolvedValue({ id: 'loy-1' });
    prisma.customerWalletLedger.aggregate.mockResolvedValue({ _sum: { amount: 125000n } });
    prisma.customerWalletLedger.create.mockResolvedValue({});

    const redeemed = await loyalty.redeemToWallet(9, { points: 50 });
    expect(redeemed.redeemedPoints).toBe(50);
    expect(redeemed.creditedRial).toBe(String(50 * 2500));
    expect(redeemed.points).toBe(30);
    expect(prisma.customerWalletLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT',
          source: 'LOYALTY_REDEEM',
          amount: 125000n,
          customerId: 7,
        }),
      }),
    );
  });

  it('uses configured minRedeemPoints from system settings instead of the hardcoded 100', async () => {
    prisma.systemSettings.upsert.mockResolvedValue({
      loyaltyRateRialPerPoint: 1000,
      loyaltyMinRedeemPoints: 200,
    });
    await expect(loyalty.redeemToWallet(9, { points: 100 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.loyaltyPointTransaction.create).not.toHaveBeenCalled();
  });

  it('falls back to 1000 rial / 100 points when system_settings is unavailable', async () => {
    prisma.systemSettings.upsert.mockRejectedValue(new Error('relation missing'));
    prisma.loyaltyPointTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { points: 150 } })
      .mockResolvedValueOnce({ _sum: { points: 50 } });
    prisma.loyaltyPointTransaction.create.mockResolvedValue({ id: 'loy-2' });
    prisma.customerWalletLedger.aggregate.mockResolvedValue({ _sum: { amount: 100000n } });
    prisma.customerWalletLedger.create.mockResolvedValue({});

    const redeemed = await loyalty.redeemToWallet(9, { points: 100 });
    expect(redeemed.creditedRial).toBe('100000');
  });
});
