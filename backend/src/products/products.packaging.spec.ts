import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

describe('ProductsService packaging and kardex', () => {
  const prisma = {
    product: { findUnique: jest.fn(), count: jest.fn() },
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
    appointment: { findMany: jest.fn() },
    orderItem: { count: jest.fn() },
    productCategory: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new ProductsService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.product.findUnique.mockResolvedValue({ id: 1, name: 'شامپو', stock: 10 });
    prisma.appointment.findMany.mockResolvedValue([]);
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

  it('joins barber and customer names for appointment kardex rows', async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue([
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
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 11,
        employee: { user: { name: 'علی' } },
        customer: { user: { name: 'مریم' } },
      },
    ]);
    const result = await service.getKardex(1, {});
    expect(result.data[0]).toMatchObject({
      barberName: 'علی',
      customerName: 'مریم',
      appointmentId: '11',
    });
  });

  it('joins barber and customer names only for appointment kardex rows in a mixed ledger', async () => {
    prisma.inventoryMovement.findMany.mockResolvedValue([
      {
        id: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        type: 'IN',
        quantity: 10,
        packagingUnit: 'عدد',
        packagingName: null,
        unitsPerPackage: 1,
        reason: 'ورود',
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
    prisma.appointment.findMany.mockResolvedValue([
      {
        id: 11,
        employee: { user: { name: 'علی' } },
        customer: { user: { name: 'مریم' } },
      },
    ]);
    const result = await service.getKardex(1, {});
    expect(result.data[0]).toMatchObject({
      barberName: null,
      customerName: null,
      appointmentId: null,
    });
    expect(result.data[1]).toMatchObject({
      barberName: 'علی',
      customerName: 'مریم',
      appointmentId: '11',
    });
  });

  it('refuses to deactivate a category that still has products', async () => {
    prisma.productCategory.findUnique.mockResolvedValue({ id: 4, name: 'رنگ', isActive: true });
    prisma.product.count.mockResolvedValue(2);
    await expect(service.deactivateCategory(4)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.productCategory.update).not.toHaveBeenCalled();
  });

  it('soft-deactivates an empty category', async () => {
    prisma.productCategory.findUnique.mockResolvedValue({ id: 5, name: 'خالی', isActive: true });
    prisma.product.count.mockResolvedValue(0);
    prisma.productCategory.update.mockResolvedValue({ id: 5, name: 'خالی', isActive: false });
    await expect(service.deactivateCategory(5)).resolves.toMatchObject({ id: 5, isActive: false });
    expect(prisma.productCategory.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { isActive: false },
    });
  });
});
