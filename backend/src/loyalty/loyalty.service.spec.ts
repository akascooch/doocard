import { BadRequestException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { LOYALTY_RIALS_PER_POINT } from '../packages/packages.constants';

describe('LoyaltyService', () => {
  const prisma = {
    customer: { findUnique: jest.fn() },
    loyaltyPointTransaction: { aggregate: jest.fn(), create: jest.fn() },
    customerWalletLedger: { aggregate: jest.fn(), create: jest.fn() },
    systemSettings: { upsert: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  const service = new LoyaltyService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.customer.findUnique.mockResolvedValue({ id: 4, userId: 9 });
    prisma.systemSettings.upsert.mockResolvedValue({
      loyaltyRateRialPerPoint: 1000,
      loyaltyMinRedeemPoints: 100,
    });
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
    prisma.$queryRaw.mockResolvedValue([{ id: 4 }]);
  });

  it('redeems points into isolated wallet credit and keeps sums in sync', async () => {
    prisma.loyaltyPointTransaction.aggregate
      .mockResolvedValueOnce({ _sum: { points: 150 } })
      .mockResolvedValueOnce({ _sum: { points: 50 } });
    prisma.loyaltyPointTransaction.create.mockResolvedValue({ id: 'l1' });
    prisma.customerWalletLedger.aggregate.mockResolvedValue({ _sum: { amount: 100000n } });
    prisma.customerWalletLedger.create.mockResolvedValue({});

    const result = await service.redeemToWallet(9, { points: 100 });
    expect(result.redeemedPoints).toBe(100);
    expect(result.creditedRial).toBe(String(100 * LOYALTY_RIALS_PER_POINT));
    expect(result.points).toBe(50);
    expect(prisma.loyaltyPointTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ points: -100, action: 'REDEEMED_WALLET', customerId: 4 }),
      }),
    );
    expect(prisma.customerWalletLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CREDIT',
          source: 'LOYALTY_REDEEM',
          amount: BigInt(100 * LOYALTY_RIALS_PER_POINT),
        }),
      }),
    );
  });

  it('rejects a second redeem that would double-spend remaining points', async () => {
    prisma.loyaltyPointTransaction.aggregate.mockResolvedValue({ _sum: { points: 50 } });
    await expect(service.redeemToWallet(9, { points: 100 })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.loyaltyPointTransaction.create).not.toHaveBeenCalled();
    expect(prisma.customerWalletLedger.create).not.toHaveBeenCalled();
  });
});
