import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService packaging and kardex', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    productPackaging: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    inventoryMovement: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    appointmentProduct: { count: jest.fn() },
    orderItem: { count: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new ProductsService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.product.findUnique.mockResolvedValue({ id: 1, name: 'شامپو', stock: 10 });
  });

  it('rejects packaging ids that belong to another product', async () => {
    prisma.productPackaging.findUnique.mockResolvedValue({
      id: 9,
      productId: 2,
      name: 'جعبه',
      unitLabel: 'عدد',
      unitsPerPackage: 6,
    });
    await expect(
      service.updatePackaging(1, 9, { name: 'کارتن' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hard-deletes unused packaging', async () => {
    prisma.productPackaging.findUnique.mockResolvedValue({
      id: 3,
      productId: 1,
      name: 'جعبه',
      unitLabel: 'عدد',
      unitsPerPackage: 6,
    });
    prisma.$transaction.mockResolvedValue([0, 0, 0]);
    prisma.productPackaging.delete.mockResolvedValue({ id: 3 });
    await expect(service.deletePackaging(1, 3)).resolves.toEqual({
      ok: true,
      deleted: true,
      id: 3,
    });
  });

  it('archives packaging referenced by historical movements', async () => {
    prisma.productPackaging.findUnique.mockResolvedValue({
      id: 4,
      productId: 1,
      name: 'پک',
      unitLabel: 'بسته',
      unitsPerPackage: 12,
    });
    prisma.$transaction.mockResolvedValue([2, 0, 0]);
    prisma.productPackaging.update.mockResolvedValue({
      id: 4,
      isActive: false,
    });
    const result = await service.deletePackaging(1, 4);
    expect(result).toMatchObject({ ok: true, deleted: false, archived: true });
    expect(prisma.productPackaging.delete).not.toHaveBeenCalled();
  });

  it('computes kardex running balance oldest-first', async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        type: 'IN',
        quantity: 10,
        packagingUnit: 'عدد',
        packagingName: null,
        unitsPerPackage: 1,
        reason: 'موجودی اولیه',
        referenceType: 'MANUAL',
        referenceId: null,
        performedBy: null,
      },
      {
        id: 2,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        type: 'APPOINTMENT_SALE',
        quantity: -3,
        packagingUnit: 'عدد',
        packagingName: null,
        unitsPerPackage: 1,
        reason: 'فروش',
        referenceType: 'APPOINTMENT',
        referenceId: 11,
        performedBy: null,
      },
    ]);
    const result = await service.getKardex(1, {});
    expect(result.data.map((row: { balanceAfter: number }) => row.balanceAfter)).toEqual([10, 7]);
    expect(result.openingBalance).toBe(0);
  });

  it('rejects invalid kardex date bounds', async () => {
    await expect(service.getKardex(1, { from: 'not-a-date' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
