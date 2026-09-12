import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { StockWaitlistChannel, StockWaitlistStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WaitlistService } from './waitlist.service';
import { PHONE_REQUIRED, PRODUCT_IN_STOCK, WAITLIST_NOT_FOUND_FA } from './waitlist.util';

describe('WaitlistService', () => {
  const tx = {
    user: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    productStockSubscription: {
      findFirst: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    productStockSubscription: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  function makeService() {
    return new WaitlistService(prisma as unknown as PrismaService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
  });

  it('rejects subscribe when the product is in stock', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 1, phone: '09121234567' });
    tx.product.findUnique.mockResolvedValue({ id: 9, isActive: true, stock: 3 });
    const service = makeService();
    try {
      await service.subscribe({ productId: 9 }, { id: 1 });
      fail('expected PRODUCT_IN_STOCK');
    } catch (err) {
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toEqual(
        expect.objectContaining({ error: PRODUCT_IN_STOCK }),
      );
    }
    expect(tx.productStockSubscription.create).not.toHaveBeenCalled();
  });

  it('returns the existing ACTIVE row on duplicate subscribe', async () => {
    const existing = {
      id: '11111111-1111-4111-8111-111111111111',
      productId: 9,
      userId: 1,
      channel: StockWaitlistChannel.SMS,
      status: StockWaitlistStatus.ACTIVE,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      cancelledAt: null,
      notifiedAt: null,
    };
    tx.user.findUnique.mockResolvedValue({ id: 1, phone: '+989121234567' });
    tx.product.findUnique.mockResolvedValue({ id: 9, isActive: true, stock: 0 });
    tx.productStockSubscription.findFirst.mockResolvedValue(existing);
    const service = makeService();
    const result = await service.subscribe({ productId: 9 }, { id: 1 });
    expect(result.id).toBe(existing.id);
    expect(result.status).toBe('ACTIVE');
    expect(tx.productStockSubscription.create).not.toHaveBeenCalled();
  });

  it('normalizes the stored phone snapshot from the user record', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 1, phone: '+989121234567' });
    tx.product.findUnique.mockResolvedValue({ id: 9, isActive: true, stock: 0 });
    tx.productStockSubscription.findFirst.mockResolvedValue(null);
    tx.productStockSubscription.create.mockImplementation(async ({ data }: any) => ({
      id: '22222222-2222-4222-8222-222222222222',
      cancelledAt: null,
      notifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    const service = makeService();
    await service.subscribe({ productId: 9 }, { id: 1 });
    expect(tx.productStockSubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phone: '09121234567', userId: 1 }),
      }),
    );
  });

  it('rejects a user without a valid phone', async () => {
    tx.user.findUnique.mockResolvedValue({ id: 1, phone: '123' });
    const service = makeService();
    try {
      await service.subscribe({ productId: 9 }, { id: 1 });
      fail('expected PHONE_REQUIRED');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: PHONE_REQUIRED }),
      );
    }
  });

  it('lists only the caller subscriptions', async () => {
    prisma.productStockSubscription.findMany.mockResolvedValue([]);
    const service = makeService();
    await service.listMine({ id: 4 });
    expect(prisma.productStockSubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 4 } }),
    );
  });

  it('does not leak another user subscription on cancel', async () => {
    prisma.productStockSubscription.findFirst.mockResolvedValue(null);
    const service = makeService();
    try {
      await service.cancel('33333333-3333-4333-8333-333333333333', { id: 4 });
      fail('expected generic 404');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(WAITLIST_NOT_FOUND_FA);
    }
    expect(prisma.productStockSubscription.update).not.toHaveBeenCalled();
  });

  it('cancel is idempotent for the owner', async () => {
    const cancelled = {
      id: '44444444-4444-4444-8444-444444444444',
      productId: 9,
      userId: 4,
      channel: StockWaitlistChannel.SMS,
      status: StockWaitlistStatus.CANCELLED,
      createdAt: new Date(),
      updatedAt: new Date(),
      cancelledAt: new Date(),
      notifiedAt: null,
    };
    prisma.productStockSubscription.findFirst.mockResolvedValue(cancelled);
    const service = makeService();
    const first = await service.cancel(cancelled.id, { id: 4 });
    const second = await service.cancel(cancelled.id, { id: 4 });
    expect(first.status).toBe('CANCELLED');
    expect(second.status).toBe('CANCELLED');
    expect(prisma.productStockSubscription.update).not.toHaveBeenCalled();
  });

  it('requires login', async () => {
    const service = makeService();
    await expect(service.listMine(null)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
