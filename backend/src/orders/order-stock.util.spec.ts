import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import {
  INSUFFICIENT_STOCK,
  INVALID_ORDER_QUANTITY,
  assertPositiveIntQuantity,
  decrementShopStockAtomic,
  insufficientStockException,
  restoreShopOrderStock,
  shouldRestoreStockOnStatusChange,
  sortedProductIds,
} from './order-stock.util';

describe('order-stock.util', () => {
  it('rejects zero, negative, and non-integer quantities', () => {
    expect(() => assertPositiveIntQuantity(0)).toThrow(BadRequestException);
    expect(() => assertPositiveIntQuantity(-1)).toThrow(BadRequestException);
    expect(() => assertPositiveIntQuantity(1.5)).toThrow(BadRequestException);
    expect(() => assertPositiveIntQuantity('2' as any)).toThrow(BadRequestException);
    expect(assertPositiveIntQuantity(3)).toBe(3);
    try {
      assertPositiveIntQuantity(0);
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: INVALID_ORDER_QUANTITY }),
      );
    }
  });

  it('builds INSUFFICIENT_STOCK for zero and short stock', () => {
    const empty = insufficientStockException('Wax', 0).getResponse() as Record<string, unknown>;
    expect(empty.error).toBe(INSUFFICIENT_STOCK);
    expect(String(empty.message)).toContain('ناموجود');
    const short = insufficientStockException('Wax', 1).getResponse() as Record<string, unknown>;
    expect(short.error).toBe(INSUFFICIENT_STOCK);
    expect(String(short.message)).toContain('موجود: 1');
  });

  it('restores stock exactly once when entering CANCELLED', () => {
    expect(shouldRestoreStockOnStatusChange(OrderStatus.PENDING_VERIFICATION, OrderStatus.CANCELLED)).toBe(true);
    expect(shouldRestoreStockOnStatusChange(OrderStatus.AWAITING_QUOTE, OrderStatus.CANCELLED)).toBe(true);
    expect(shouldRestoreStockOnStatusChange(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(true);
    expect(shouldRestoreStockOnStatusChange(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(false);
    expect(shouldRestoreStockOnStatusChange(OrderStatus.PENDING_VERIFICATION, OrderStatus.PAID)).toBe(false);
  });

  it('sorts product ids for a stable lock order', () => {
    expect(sortedProductIds([9, 1, 3])).toEqual([1, 3, 9]);
  });

  it('rejects decrement when stock is 0', async () => {
    const tx = {
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ stock: 0, name: 'Gel' }),
      },
    };
    try {
      await decrementShopStockAtomic(tx as any, 1, 1, 'Gel');
      fail('expected INSUFFICIENT_STOCK');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: INSUFFICIENT_STOCK }),
      );
    }
  });

  it('rejects decrement when quantity exceeds remaining stock', async () => {
    const tx = {
      product: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({ stock: 2, name: 'Gel' }),
      },
    };
    await expect(decrementShopStockAtomic(tx as any, 1, 3, 'Gel')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('only one of two concurrent decrements succeeds when stock is 1', async () => {
    let stock = 1;
    const tx = {
      product: {
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (stock >= where.stock.gte) {
            stock -= data.stock.decrement;
            return { count: 1 };
          }
          return { count: 0 };
        }),
        findUnique: jest.fn(async () => ({ stock, name: 'Gel' })),
      },
    };
    const results = await Promise.allSettled([
      decrementShopStockAtomic(tx as any, 1, 1, 'Gel'),
      decrementShopStockAtomic(tx as any, 1, 1, 'Gel'),
    ]);
    const fulfilled = results.filter((row) => row.status === 'fulfilled');
    const rejected = results.filter((row) => row.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(stock).toBe(0);
    expect((rejected[0].reason as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ error: INSUFFICIENT_STOCK }),
    );
  });

  it('restores cancelled order quantities without a second increment', async () => {
    let stock = 0;
    const tx = {
      product: {
        update: jest.fn(async ({ data }: any) => {
          stock += data.stock.increment;
        }),
      },
    };
    await restoreShopOrderStock(tx as any, [{ productId: 1, quantity: 2 }]);
    expect(stock).toBe(2);
    expect(shouldRestoreStockOnStatusChange(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(
      false,
    );
  });
});
