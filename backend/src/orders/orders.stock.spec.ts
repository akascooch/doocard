import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { ProductsService } from '../products/products.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';
import { INSUFFICIENT_STOCK, INVALID_ORDER_QUANTITY } from './order-stock.util';

describe('ProductsService listPublicCatalog', () => {
  it('returns public stock fields and omits warehouse internals', async () => {
    const prisma = {
      productCategory: {
        findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Care' }]),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 9,
            name: 'Gel',
            description: null,
            images: [],
            priceRial: 50000n,
            isPriceVisible: true,
            stock: 4,
            category: { id: 1, name: 'Care' },
          },
        ]),
      },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const service = new ProductsService(prisma as unknown as PrismaService);
    const result = await service.listPublicCatalog({});
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ stock: true }),
      }),
    );
    const select = prisma.product.findMany.mock.calls[0][0].select;
    expect(select.sku).toBeUndefined();
    expect(select.lowStockAlert).toBeUndefined();
    expect(select.movements).toBeUndefined();
    expect(result.products[0]).toEqual(
      expect.objectContaining({
        id: 9,
        stock: 4,
        inStock: true,
        stockStatus: 'IN_STOCK',
        priceRial: '50000',
      }),
    );
    expect(result.products[0]).not.toHaveProperty('sku');
    expect(result.products[0]).not.toHaveProperty('lowStockAlert');
  });
});

describe('OrdersService shop stock', () => {
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
    items: [{ productId: 1, quantity: 1 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: any) => fn(tx));
  });

  async function createOrder(service: OrdersService, dto = baseDto) {
    jest.spyOn(service, 'saveReceipt').mockReturnValue('/uploads/receipts/ok.jpg');
    return (service as any).createOrderRecord(dto, {
      buffer: Buffer.from('ok'),
      size: 2,
      mimetype: 'image/jpeg',
    });
  }

  it('rejects ordering a product with stock 0', async () => {
    tx.product.findMany.mockResolvedValue([
      { id: 1, name: 'Gel', isActive: true, stock: 0, priceRial: 1000n, isPriceVisible: true },
    ]);
    const service = makeService();
    try {
      await createOrder(service);
      fail('expected INSUFFICIENT_STOCK');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: INSUFFICIENT_STOCK }),
      );
    }
    expect(tx.product.updateMany).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects quantity greater than remaining stock', async () => {
    tx.product.findMany.mockResolvedValue([
      { id: 1, name: 'Gel', isActive: true, stock: 2, priceRial: 1000n, isPriceVisible: true },
    ]);
    const service = makeService();
    await expect(createOrder(service, { ...baseDto, items: [{ productId: 1, quantity: 3 }] })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects zero quantity before touching stock', async () => {
    const service = makeService();
    try {
      await createOrder(service, { ...baseDto, items: [{ productId: 1, quantity: 0 }] });
      fail('expected INVALID_ORDER_QUANTITY');
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: INVALID_ORDER_QUANTITY }),
      );
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lets only one concurrent order succeed when stock is 1', async () => {
    let stock = 1;
    tx.product.findMany.mockResolvedValue([
      { id: 1, name: 'Gel', isActive: true, stock: 1, priceRial: 1000n, isPriceVisible: true },
    ]);
    tx.product.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (stock >= where.stock.gte) {
        stock -= data.stock.decrement;
        return { count: 1 };
      }
      return { count: 0 };
    });
    tx.product.findUnique.mockImplementation(async () => ({ stock, name: 'Gel' }));
    tx.order.create.mockImplementation(async ({ data }: any) => ({
      id: 'ord-1',
      orderNumber: data.orderNumber,
      status: OrderStatus.PENDING_VERIFICATION,
      totalAmountRial: data.totalAmountRial,
      items: [{ productId: 1, quantity: 1, unitPriceRial: 1000n, lineTotalRial: 1000n }],
    }));
    const service = makeService();
    const results = await Promise.allSettled([createOrder(service), createOrder(service)]);
    const fulfilled = results.filter((row) => row.status === 'fulfilled');
    const rejected = results.filter((row) => row.status === 'rejected') as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(stock).toBe(0);
    expect((rejected[0].reason as BadRequestException).getResponse()).toEqual(
      expect.objectContaining({ error: INSUFFICIENT_STOCK }),
    );
  });

  it('restores stock once on cancel and ignores a second cancel', async () => {
    let stock = 0;
    let status: OrderStatus = OrderStatus.PENDING_VERIFICATION;
    const items = [{ productId: 1, quantity: 2, unitPriceRial: 1000n, lineTotalRial: 2000n }];
    tx.$queryRaw.mockResolvedValue([{ id: 'ord-1' }]);
    tx.order.findUnique.mockImplementation(async () => ({
      id: 'ord-1',
      status,
      adminNotes: null,
      trackingCode: null,
      verifiedAt: null,
      items,
      totalAmountRial: 2000n,
    }));
    tx.product.findMany.mockResolvedValue([{ id: 1, stock: 0 }]);
    tx.product.update.mockImplementation(async ({ data }: any) => {
      stock += data.stock.increment;
    });
    tx.order.update.mockImplementation(async ({ data }: any) => {
      status = data.status;
      return {
        id: 'ord-1',
        status,
        totalAmountRial: 2000n,
        items,
      };
    });
    const service = makeService();
    await service.updateStatus('ord-1', { status: OrderStatus.CANCELLED });
    expect(stock).toBe(2);
    await service.updateStatus('ord-1', { status: OrderStatus.CANCELLED });
    expect(stock).toBe(2);
    expect(tx.product.update).toHaveBeenCalledTimes(1);
  });
});
