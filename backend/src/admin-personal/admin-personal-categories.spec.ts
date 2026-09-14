import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminPersonalService } from './admin-personal.service';

function categoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-custom',
    userId: 3,
    name: 'اجاره خانه',
    isDefault: false,
    archivedAt: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('admin-personal-categories (v2.0.7)', () => {
  const prisma = {
    adminExpenseCategory: {
      count: jest.fn(),
      createMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    adminPersonalExpense: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new AdminPersonalService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminExpenseCategory.count.mockResolvedValue(4);
  });

  it('creates a custom category, assigns it to an expense, then archives it', async () => {
    const created = categoryRow();
    prisma.adminExpenseCategory.findUnique.mockResolvedValueOnce(null);
    prisma.adminExpenseCategory.create.mockResolvedValue(created);

    const category = await service.createCategory(3, { name: '  اجاره خانه  ' });
    expect(category).toMatchObject({ id: 'cat-custom', name: 'اجاره خانه', isDefault: false, archivedAt: null });
    expect(prisma.adminExpenseCategory.create).toHaveBeenCalledWith({
      data: { userId: 3, name: 'اجاره خانه', isDefault: false },
    });

    prisma.adminExpenseCategory.findFirst.mockResolvedValueOnce(created);
    prisma.adminPersonalExpense.create.mockResolvedValue({
      id: 'exp-1',
      userId: 3,
      amount: 2500000n,
      category: 'PERSONAL',
      categoryId: 'cat-custom',
      title: 'اجاره شهریور',
      description: null,
      dateKey: '2026-09-14',
      occurredAt: new Date('2026-09-14T08:30:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      categoryRel: { id: 'cat-custom', name: 'اجاره خانه' },
    });

    const expense = await service.createExpense(3, {
      amount: '2500000',
      title: 'اجاره شهریور',
      categoryId: 'cat-custom',
      dateKey: '2026-09-14',
    });
    expect(expense.categoryId).toBe('cat-custom');
    expect(expense.categoryName).toBe('اجاره خانه');
    expect(expense.category).toBe('PERSONAL');
    expect(prisma.adminPersonalExpense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 3,
          category: 'PERSONAL',
          categoryId: 'cat-custom',
          amount: 2500000n,
        }),
      }),
    );

    prisma.adminExpenseCategory.findFirst.mockResolvedValueOnce(created);
    prisma.adminExpenseCategory.update.mockResolvedValue({ ...created, archivedAt: new Date() });
    await expect(service.archiveCategory(3, 'cat-custom')).resolves.toEqual({ ok: true, id: 'cat-custom' });
    expect(prisma.adminExpenseCategory.update).toHaveBeenCalledWith({
      where: { id: 'cat-custom' },
      data: { archivedAt: expect.any(Date) },
    });
  });

  it('restores an archived category when the same name is created again', async () => {
    const archived = categoryRow({ archivedAt: new Date('2026-09-10T00:00:00.000Z') });
    prisma.adminExpenseCategory.findUnique.mockResolvedValue(archived);
    prisma.adminExpenseCategory.update.mockResolvedValue(categoryRow({ archivedAt: null }));

    const restored = await service.createCategory(3, { name: 'اجاره خانه' });
    expect(restored.archivedAt).toBeNull();
    expect(prisma.adminExpenseCategory.create).not.toHaveBeenCalled();
    expect(prisma.adminExpenseCategory.update).toHaveBeenCalledWith({
      where: { id: 'cat-custom' },
      data: { archivedAt: null },
    });
  });

  it('rejects a duplicate live category name and an archived categoryId on expense create', async () => {
    prisma.adminExpenseCategory.findUnique.mockResolvedValue(categoryRow());
    await expect(service.createCategory(3, { name: 'اجاره خانه' })).rejects.toBeInstanceOf(BadRequestException);

    prisma.adminExpenseCategory.findFirst.mockResolvedValue(null);
    await expect(
      service.createExpense(3, { amount: '1000', title: 'چای', categoryId: 'archived-or-foreign' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.adminPersonalExpense.create).not.toHaveBeenCalled();
  });
});
