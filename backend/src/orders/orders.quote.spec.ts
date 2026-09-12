import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { PAYMENT_NOT_ALLOWED_FOR_QUOTE } from './order-quote.util';

describe('OrdersService quote pricing', () => {
  const tx = {
    product: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
  };

  function makeService() {
    return new OrdersService(prisma as unknown as PrismaService, {} as any, {} as any, {} as any);
  }

  const baseDto = {
    customerName: 'علی تست',
    customerPhone: '09121234567',
    items: [{ productId: 1, quantity: 2 }],
  };

  const receiptFile = {
    buffer: Buffer.from('ok'),
    size: 2,
    mimetype: 'image/jpeg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.$queryRaw.mockResolvedValue([{ id: 'ord-1' }]);
  });

  it('creates PENDING_VERIFICATION for fixed-price products and uses DB prices', async () => {
    tx.product.findMany.mockResolvedValue([
      { id: 1, name: 'Gel', isActive: true, stock: 5, priceRial: 15000n, isPriceVisible: true },
    ]);
    tx.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'ord-priced',
      ...data,
      items: data.items.create,
    }));
    const service = makeService();
    const save = jest.spyOn(service, 'saveReceipt').mockReturnValue('/uploads/receipts/ok.jpg');
    const order = await (service as any).createOrderRecord(baseDto, receiptFile);
    expect(save).toHaveBeenCalled();
    expect(order.status).toBe(OrderStatus.PENDING_VERIFICATION);
    expect(order.totalAmountRial).toBe(30000n);
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.PENDING_VERIFICATION,
          totalAmountRial: 30000n,
          receiptImageUrl: '/uploads/receipts/ok.jpg',
        }),
      }),
    );
  });

  it('creates AWAITING_QUOTE with zero totals when any product hides its price', async () => {
    tx.product.findMany.mockResolvedValue([
      { id: 1, name: 'Custom', isActive: true, stock: 5, priceRial: 99000n, isPriceVisible: false },
    ]);
    tx.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'ord-quote',
      ...data,
      items: data.items.create,
    }));
    const service = makeService();
    const save = jest.spyOn(service, 'saveReceipt');
    const order = await (service as any).createOrderRecord(baseDto, undefined);
    expect(save).not.toHaveBeenCalled();
    expect(order.status).toBe(OrderStatus.AWAITING_QUOTE);
    expect(order.totalAmountRial).toBe(0n);
    expect(order.receiptImageUrl).toBeNull();
    expect(order.items[0].unitPriceRial).toBe(0n);
    expect(order.items[0].lineTotalRial).toBe(0n);
    expect(tx.product.updateMany).toHaveBeenCalled();
  });

  it('treats mixed carts as quote orders with a zero snapshot total', async () => {
    tx.product.findMany.mockResolvedValue([
      { id: 1, name: 'Gel', isActive: true, stock: 5, priceRial: 15000n, isPriceVisible: true },
      { id: 2, name: 'Custom', isActive: true, stock: 3, priceRial: 50000n, isPriceVisible: false },
    ]);
    tx.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'ord-mixed',
      ...data,
      items: data.items.create,
    }));
    const service = makeService();
    const save = jest.spyOn(service, 'saveReceipt');
    const order = await (service as any).createOrderRecord(
      {
        ...baseDto,
        items: [
          { productId: 1, quantity: 1 },
          { productId: 2, quantity: 1 },
        ],
      },
      receiptFile,
    );
    expect(order.status).toBe(OrderStatus.AWAITING_QUOTE);
    expect(order.totalAmountRial).toBe(0n);
    expect(save).not.toHaveBeenCalled();
    expect(order.items.every((item: { unitPriceRial: bigint }) => item.unitPriceRial === 0n)).toBe(
      true,
    );
  });

  it('blocks marking an AWAITING_QUOTE order as PAID', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'ord-1',
      status: OrderStatus.AWAITING_QUOTE,
      adminNotes: null,
      trackingCode: null,
      verifiedAt: null,
      totalAmountRial: 0n,
      items: [{ productId: 1, quantity: 1, unitPriceRial: 0n, lineTotalRial: 0n }],
    });
    const service = makeService();
    try {
      await service.updateStatus('ord-1', { status: OrderStatus.PAID });
      fail('expected PAYMENT_NOT_ALLOWED_FOR_QUOTE');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: PAYMENT_NOT_ALLOWED_FOR_QUOTE }),
      );
    }
    expect(tx.order.update).not.toHaveBeenCalled();
  });

  it('stores quotedTotalRial when leaving AWAITING_QUOTE', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 'ord-1',
      status: OrderStatus.AWAITING_QUOTE,
      adminNotes: null,
      trackingCode: null,
      verifiedAt: null,
      totalAmountRial: 0n,
      items: [{ productId: 1, quantity: 1, unitPriceRial: 0n, lineTotalRial: 0n }],
    });
    tx.order.update.mockImplementation(async ({ data }: any) => ({
      id: 'ord-1',
      ...data,
      items: [{ productId: 1, quantity: 1, unitPriceRial: 0n, lineTotalRial: 0n }],
    }));
    const service = makeService();
    const updated = await service.updateStatus('ord-1', {
      status: OrderStatus.PENDING_VERIFICATION,
      quotedTotalRial: 120000,
    });
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.PENDING_VERIFICATION,
          totalAmountRial: 120000n,
        }),
      }),
    );
    expect(updated.status).toBe(OrderStatus.PENDING_VERIFICATION);
    expect(updated.totalAmountRial).toBe('120000');
  });
});
