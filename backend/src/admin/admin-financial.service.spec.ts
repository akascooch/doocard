import { AdminFinancialService } from './admin-financial.service';
import {
  operatingExpenseWhere,
  STAFF_WAGE_EXPENSE_SOURCE_TYPES,
} from './operating-expense.where';
import { EMPLOYEE_EXPENSE_CATEGORY_CODES } from '../common/constants/employee-commission.constants';

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
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-31T23:59:59.000Z');
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: null, _sum: { amount: 250000n } },
      { categoryId: 3, _sum: { amount: 100000n } },
    ]);
    prisma.transactionCategory.findMany.mockResolvedValue([{ id: 3, name: 'اجاره' }]);

    const rows = await (service as any).getMonthlyExpenseByCategory(start, end);

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['categoryId'],
        where: operatingExpenseWhere(start, end),
      }),
    );
    const where = prisma.transaction.groupBy.mock.calls[0][0].where;
    expect(where.categoryId).toBeUndefined();
    expect(JSON.stringify(where)).not.toContain('"10"');
    expect(rows).toEqual([
      { name: 'وصول چک / بدون دسته', total: '250000' },
      { name: 'اجاره', total: '100000' },
    ]);
  });

  it('sums operating EXPENSE rows with the same predicate as the category chart', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-31T23:59:59.000Z');
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 350000n } });
    prisma.transaction.groupBy.mockResolvedValue([]);
    const total = await (service as any).getMonthlyExpenseTotal(start, end);
    await (service as any).getMonthlyExpenseByCategory(start, end);
    expect(total).toBe(350000n);
    const totalWhere = prisma.transaction.aggregate.mock.calls[0][0].where;
    const categoryWhere = prisma.transaction.groupBy.mock.calls[0][0].where;
    expect(totalWhere).toEqual(operatingExpenseWhere(start, end));
    expect(categoryWhere).toEqual(totalWhere);
    expect(totalWhere.categoryId).toBeUndefined();
  });

  it('uses one predicate that drops staff wages and keeps operating cheques', () => {
    const where = operatingExpenseWhere(
      new Date('2026-03-21T00:00:00.000Z'),
      new Date('2026-04-20T23:59:59.000Z'),
    );
    const excluded = where.NOT as {
      OR: Array<{ sourceType?: { in: string[] }; category?: { code: { in: string[] } } }>;
    };
    expect(excluded.OR[0].sourceType?.in).toEqual([...STAFF_WAGE_EXPENSE_SOURCE_TYPES]);
    expect(excluded.OR[0].sourceType?.in).not.toContain('CHEQUE_LEAF');
    expect(excluded.OR[1].category?.code.in).toEqual([...EMPLOYEE_EXPENSE_CATEGORY_CODES]);
    expect(where.occurredAt).toEqual({
      gte: new Date('2026-03-21T00:00:00.000Z'),
      lte: new Date('2026-04-20T23:59:59.000Z'),
    });
  });
});
