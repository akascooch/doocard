import { BadRequestException, Injectable } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  getJalaliInclusiveRange,
  getJalaliMonthRanges,
  toJalaliStringTehran,
} from '../common/utils/date-utils';
import {
  operatingExpenseWhere,
  OPERATING_CHEQUE_SOURCE_TYPE,
  splitExpenseChart,
  UNCATEGORIZED_EXPENSE_LABEL,
} from './operating-expense.where';

const SETTLED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.PAID,
  AppointmentStatus.SETTLED,
];

export interface YearlyReportMonth {
  month: string;
  expense: {
    total: string;
    other: string;
    cheques: string;
    categories: Array<{ name: string; total: string; categoryId: number | null }>;
  };
  revenue: {
    total: string;
    appointmentCount: number;
    employees: Array<{ name: string; count: number; amount: string }>;
  };
  settlementDeduction: {
    total: string;
  };
}

export interface YearlyReportDto {
  year: number;
  months: YearlyReportMonth[];
  employeeRanking: Array<{ name: string; count: number; amount: string }>;
}

export type ExpenseDrillBucket = 'cheque' | 'uncategorized' | 'category';

export type ExpenseDrillQuery = {
  year?: number;
  month?: number;
  fromJalali?: string;
  toJalali?: string;
  bucket: ExpenseDrillBucket;
  categoryId?: number;
  createdBy?: number;
  cursor?: number;
  limit?: number;
};

export type ExpenseDrillItem = {
  id: number;
  occurredAt: string;
  occurredAtJalali: string;
  amountRial: string;
  description: string | null;
  sourceType: string | null;
  categoryId: number | null;
  categoryName: string | null;
  createdBy: number | null;
};

@Injectable()
export class AdminFinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async getYearlyReport(jy: number): Promise<YearlyReportDto> {
    const ranges = getJalaliMonthRanges(jy);
    const months: YearlyReportMonth[] = [];

    for (const { monthName, start, end } of ranges) {
      const [expenseTotal, chequeTotal, expenseByCategory, revenueTotal, revenueCount, revenueByEmployee, settlementDeductionTotal] =
        await Promise.all([
          this.getMonthlyExpenseTotal(start, end),
          this.getMonthlyOperatingChequeTotal(start, end),
          this.getMonthlyExpenseByCategory(start, end),
          this.getMonthlyRevenueTotal(start, end),
          this.getMonthlyRevenueAppointmentCount(start, end),
          this.getMonthlyRevenueByEmployee(start, end),
          this.getMonthlySettlementDeductionTotal(start, end),
        ]);
      const split = splitExpenseChart(expenseTotal, chequeTotal);

      months.push({
        month: monthName,
        expense: {
          total: String(split.total),
          other: String(split.other),
          cheques: String(split.cheques),
          categories: expenseByCategory,
        },
        revenue: {
          total: String(revenueTotal),
          appointmentCount: revenueCount,
          employees: revenueByEmployee,
        },
        settlementDeduction: {
          total: String(settlementDeductionTotal),
        },
      });
    }

    const employeeRanking = await this.getYearlyEmployeeRanking(ranges[0].start, ranges[11].end);

    return {
      year: jy,
      months,
      employeeRanking,
    };
  }

  async getExpenseDrilldown(query: ExpenseDrillQuery): Promise<{
    bucket: ExpenseDrillBucket;
    from: string;
    to: string;
    sumRial: string;
    count: number;
    items: ExpenseDrillItem[];
    nextCursor: number | null;
  }> {
    const { start, end } = this.resolveExpenseWindow(query);
    const extra: Prisma.TransactionWhereInput[] = [];
    if (query.bucket === 'cheque') {
      extra.push({ sourceType: OPERATING_CHEQUE_SOURCE_TYPE });
    } else if (query.bucket === 'uncategorized') {
      extra.push({
        categoryId: null,
        OR: [
          { sourceType: null },
          { sourceType: { not: OPERATING_CHEQUE_SOURCE_TYPE } },
        ],
      });
    } else if (query.bucket === 'category') {
      if (query.categoryId == null || !Number.isFinite(query.categoryId)) {
        throw new BadRequestException('categoryId is required for bucket=category');
      }
      extra.push({
        categoryId: query.categoryId,
        OR: [
          { sourceType: null },
          { sourceType: { not: OPERATING_CHEQUE_SOURCE_TYPE } },
        ],
      });
    } else {
      throw new BadRequestException('invalid bucket');
    }
    if (query.createdBy != null && Number.isFinite(query.createdBy)) {
      extra.push({ createdBy: query.createdBy });
    }

    const where: Prisma.TransactionWhereInput = {
      AND: [operatingExpenseWhere(start, end), ...extra],
    };
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const pagedWhere: Prisma.TransactionWhereInput = query.cursor
      ? { AND: [where, { id: { lt: query.cursor } }] }
      : where;

    const [sum, count, rows] = await Promise.all([
      this.prisma.transaction.aggregate({ _sum: { amount: true }, where }),
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({
        where: pagedWhere,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          occurredAt: true,
          amount: true,
          description: true,
          sourceType: true,
          categoryId: true,
          createdBy: true,
          category: { select: { name: true } },
        },
      }),
    ]);

    return {
      bucket: query.bucket,
      from: start.toISOString(),
      to: end.toISOString(),
      sumRial: String(sum._sum.amount ?? 0n),
      count,
      items: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        occurredAtJalali: toJalaliStringTehran(row.occurredAt),
        amountRial: String(row.amount),
        description: row.description,
        sourceType: row.sourceType,
        categoryId: row.categoryId,
        categoryName: row.category?.name ?? null,
        createdBy: row.createdBy,
      })),
      nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
    };
  }

  private resolveExpenseWindow(query: ExpenseDrillQuery): { start: Date; end: Date } {
    if (query.year != null && query.month != null) {
      if (!Number.isFinite(query.year) || query.year < 1300 || query.year > 1500) {
        throw new BadRequestException('invalid year');
      }
      if (!Number.isFinite(query.month) || query.month < 1 || query.month > 12) {
        throw new BadRequestException('invalid month');
      }
      const range = getJalaliMonthRanges(query.year)[query.month - 1];
      return { start: range.start, end: range.end };
    }
    if (query.fromJalali && query.toJalali) {
      const range = getJalaliInclusiveRange(query.fromJalali, query.toJalali);
      if (!range) throw new BadRequestException('invalid fromJalali/toJalali');
      return range;
    }
    throw new BadRequestException('year+month or fromJalali+toJalali is required');
  }

  private async getMonthlyExpenseTotal(start: Date, end: Date): Promise<bigint> {
    const agg = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: operatingExpenseWhere(start, end),
    });
    return agg._sum.amount ?? BigInt(0);
  }

  /** Cleared operating cheques already inside the expense total. Not added again. */
  private async getMonthlyOperatingChequeTotal(start: Date, end: Date): Promise<bigint> {
    const agg = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        AND: [
          operatingExpenseWhere(start, end),
          { sourceType: OPERATING_CHEQUE_SOURCE_TYPE },
        ],
      },
    });
    return agg._sum.amount ?? BigInt(0);
  }

  /** Operating expenses that are not cleared cheques (those form the چک وصول‌شده series). */
  private nonChequeOperatingWhere(start: Date, end: Date): Prisma.TransactionWhereInput {
    return {
      AND: [
        operatingExpenseWhere(start, end),
        {
          OR: [
            { sourceType: null },
            { sourceType: { not: OPERATING_CHEQUE_SOURCE_TYPE } },
          ],
        },
      ],
    };
  }

  private async getMonthlyExpenseByCategory(
    start: Date,
    end: Date,
  ): Promise<Array<{ name: string; total: string; categoryId: number | null }>> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: this.nonChequeOperatingWhere(start, end),
      _sum: { amount: true },
    });

    if (groups.length === 0) return [];

    const categoryIds = groups.map((g) => g.categoryId).filter((id): id is number => id != null);
    const categories = await this.prisma.transactionCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    const byId = new Map(categories.map((c) => [c.id, c.name]));

    const merged = new Map<string, { total: bigint; categoryId: number | null }>();
    for (const group of groups) {
      const named =
        group.categoryId == null ? null : byId.get(group.categoryId) ?? null;
      const name = named ?? UNCATEGORIZED_EXPENSE_LABEL;
      const amount = BigInt(group._sum.amount ?? 0);
      const existing = merged.get(name);
      if (existing) {
        existing.total += amount;
      } else {
        merged.set(name, {
          total: amount,
          categoryId: named ? group.categoryId : null,
        });
      }
    }

    const result = [...merged.entries()].map(([name, row]) => ({
      name,
      total: String(row.total),
      categoryId: row.categoryId,
    }));
    result.sort((a, b) => {
      const diff = BigInt(b.total) - BigInt(a.total);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    return result;
  }

  private async getMonthlyRevenueTotal(start: Date, end: Date): Promise<bigint> {
    const agg = await this.prisma.appointment.aggregate({
      _sum: { amount: true },
      where: {
        status: { in: SETTLED_STATUSES },
        deletedAt: null,
        paidAt: { not: null, gte: start, lte: end },
      },
    });
    return agg._sum.amount ?? BigInt(0);
  }

  /** Same filter as getMonthlyRevenueTotal — settled sales volume, not createdAt. */
  private async getMonthlyRevenueAppointmentCount(start: Date, end: Date): Promise<number> {
    return this.prisma.appointment.count({
      where: {
        status: { in: SETTLED_STATUSES },
        deletedAt: null,
        paidAt: { not: null, gte: start, lte: end },
      },
    });
  }

  private async getMonthlyRevenueByEmployee(
    start: Date,
    end: Date,
  ): Promise<Array<{ name: string; count: number; amount: string }>> {
    const groups = await this.prisma.appointment.groupBy({
      by: ['employeeId'],
      where: {
        status: { in: SETTLED_STATUSES },
        deletedAt: null,
        paidAt: { not: null, gte: start, lte: end },
        employeeId: { not: null },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    if (groups.length === 0) return [];

    const employeeIds = groups
      .map((g) => g.employeeId)
      .filter((id): id is number => id != null);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { user: true },
    });
    const byId = new Map(employees.map((e) => [e.id, e.user?.name ?? 'نامشخص']));

    return groups
      .map((g) => ({
        name: byId.get(g.employeeId!) ?? 'نامشخص',
        count: g._count.id,
        amount: String(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.count - a.count);
  }

  private async getMonthlySettlementDeductionTotal(start: Date, end: Date): Promise<bigint> {
    const agg = await this.prisma.appointment.aggregate({
      _sum: { settlementDeductionAmount: true },
      where: {
        status: { in: SETTLED_STATUSES },
        deletedAt: null,
        paidAt: { not: null, gte: start, lte: end },
        settlementDeductionAmount: { not: null },
      },
    });
    return agg._sum.settlementDeductionAmount ?? BigInt(0);
  }

  private async getYearlyEmployeeRanking(
    yearStart: Date,
    yearEnd: Date,
  ): Promise<Array<{ name: string; count: number; amount: string }>> {
    const groups = await this.prisma.appointment.groupBy({
      by: ['employeeId'],
      where: {
        status: { in: SETTLED_STATUSES },
        deletedAt: null,
        paidAt: { not: null, gte: yearStart, lte: yearEnd },
        employeeId: { not: null },
      },
      _count: { id: true },
      _sum: { amount: true },
    });

    if (groups.length === 0) return [];

    const employeeIds = groups
      .map((g) => g.employeeId)
      .filter((id): id is number => id != null);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { user: true },
    });
    const byId = new Map(employees.map((e) => [e.id, e.user?.name ?? 'نامشخص']));

    return groups
      .map((g) => ({
        name: byId.get(g.employeeId!) ?? 'نامشخص',
        count: g._count.id,
        amount: String(g._sum.amount ?? 0),
      }))
      .sort((a, b) => b.count - a.count);
  }
}
