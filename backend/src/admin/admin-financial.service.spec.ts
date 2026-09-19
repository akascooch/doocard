import { AdminFinancialService } from './admin-financial.service';

describe('AdminFinancialService expense aggregation', () => {
  const prisma = {
    transaction: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    transactionCategory: {
      findMany: jest.fn(),
    },
    appointment: {
      aggregate: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    employee: {
      findMany: jest.fn(),
    },
  };

  const service = new AdminFinancialService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('includes EXPENSE rows with null categoryId (cleared cheques) in the monthly category chart', async () => {
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: null, _sum: { amount: 250000n } },
      { categoryId: 3, _sum: { amount: 100000n } },
    ]);
    prisma.transactionCategory.findMany.mockResolvedValue([{ id: 3, name: 'اجاره' }]);

    const rows = await (service as any).getMonthlyExpenseByCategory(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T23:59:59.000Z'),
    );

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['categoryId'],
        where: expect.objectContaining({
          type: 'EXPENSE',
          deletedAt: null,
        }),
      }),
    );
    const where = prisma.transaction.groupBy.mock.calls[0][0].where;
    expect(where.categoryId).toBeUndefined();
    expect(rows).toEqual([
      { name: 'وصول چک / بدون دسته', total: '250000' },
      { name: 'اجاره', total: '100000' },
    ]);
  });

  it('sums all EXPENSE rows including null categoryId', async () => {
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 350000n } });
    const total = await (service as any).getMonthlyExpenseTotal(
      new Date('2026-01-01T00:00:00.000Z'),
      new Date('2026-01-31T23:59:59.000Z'),
    );
    expect(total).toBe(350000n);
    const where = prisma.transaction.aggregate.mock.calls[0][0].where;
    expect(where).toEqual(
      expect.objectContaining({
        type: 'EXPENSE',
        deletedAt: null,
      }),
    );
    expect(where.categoryId).toBeUndefined();
  });
});
