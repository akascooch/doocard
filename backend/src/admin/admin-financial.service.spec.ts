import { AdminFinancialService } from './admin-financial.service';
import {
  operatingExpenseWhere,
  PAYROLL_WITHDRAWAL_CATEGORY_CODES,
  PAYROLL_WITHDRAWAL_SOURCE_TYPES,
  UNCATEGORIZED_EXPENSE_LABEL,
} from './operating-expense.where';

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

  it('keeps an ordinary categorized expense and buckets missing categories separately from سایر', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z');
    const end = new Date('2026-01-31T23:59:59.000Z');
    prisma.transaction.groupBy.mockResolvedValue([
      { categoryId: null, _sum: { amount: 250000n } },
      { categoryId: 99, _sum: { amount: 50000n } },
      { categoryId: 3, _sum: { amount: 100000n } },
      { categoryId: 2, _sum: { amount: 40000n } },
    ]);
    prisma.transactionCategory.findMany.mockResolvedValue([
      { id: 3, name: 'اجاره' },
      { id: 2, name: 'سایر' },
    ]);

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
      { name: UNCATEGORIZED_EXPENSE_LABEL, total: '300000' },
      { name: 'اجاره', total: '100000' },
      { name: 'سایر', total: '40000' },
    ]);
    expect(rows.map((row: { name: string }) => row.name)).toContain('اجاره');
    expect(rows.filter((row: { name: string }) => row.name === 'سایر')).toHaveLength(1);
    expect(UNCATEGORIZED_EXPENSE_LABEL).toBe('بدون دسته‌بندی');
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

  it('excludes only payroll withdrawal markers and keeps operating cheques', () => {
    const where = operatingExpenseWhere(
      new Date('2026-03-21T00:00:00.000Z'),
      new Date('2026-04-20T23:59:59.000Z'),
    );
    const excluded = where.NOT as {
      OR: Array<{ sourceType?: { in: string[] }; category?: { code: { in: string[] } } }>;
    };
    expect(excluded.OR[0].sourceType?.in).toEqual([...PAYROLL_WITHDRAWAL_SOURCE_TYPES]);
    expect(excluded.OR[0].sourceType?.in).toEqual([
      'CHEQUE_LEAF_PAYROLL',
      'SALARY_REQUEST',
      'COMMISSION_SETTLEMENT',
    ]);
    expect(excluded.OR[0].sourceType?.in).not.toContain('CHEQUE_LEAF');
    expect(excluded.OR[0].sourceType?.in).not.toContain('EXCEL_IMPORT:PAYS');
    expect(excluded.OR[1].category?.code.in).toEqual([
      ...PAYROLL_WITHDRAWAL_CATEGORY_CODES,
    ]);
    expect(excluded.OR[1].category?.code.in).toEqual([
      'EMPLOYEE_WITHDRAWAL',
      'COMMISSION_SETTLEMENT',
      'SALARY_ADVANCE',
      'PAYROLL',
      'EMPLOYEE_WITHDRAWAL_LEGACY',
    ]);
    expect(where.type).toBe('EXPENSE');
    expect(where.occurredAt).toEqual({
      gte: new Date('2026-03-21T00:00:00.000Z'),
      lte: new Date('2026-04-20T23:59:59.000Z'),
    });
  });
});
