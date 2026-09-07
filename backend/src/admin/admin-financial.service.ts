import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getJalaliMonthRanges } from '../common/utils/date-utils';

const SETTLED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.PAID,
  AppointmentStatus.SETTLED,
];

export interface YearlyReportMonth {
  month: string;
  expense: {
    total: string;
    categories: Array<{ name: string; total: string }>;
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

@Injectable()
export class AdminFinancialService {
  constructor(private readonly prisma: PrismaService) {}

  async getYearlyReport(jy: number): Promise<YearlyReportDto> {
    const ranges = getJalaliMonthRanges(jy);
    const months: YearlyReportMonth[] = [];

    for (const { monthName, start, end } of ranges) {
      const [expenseTotal, expenseByCategory, revenueTotal, revenueCount, revenueByEmployee, settlementDeductionTotal] =
        await Promise.all([
          this.getMonthlyExpenseTotal(start, end),
          this.getMonthlyExpenseByCategory(start, end),
          this.getMonthlyRevenueTotal(start, end),
          this.getMonthlyRevenueAppointmentCount(start, end),
          this.getMonthlyRevenueByEmployee(start, end),
          this.getMonthlySettlementDeductionTotal(start, end),
        ]);

      months.push({
        month: monthName,
        expense: {
          total: String(expenseTotal),
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

  private async getMonthlyExpenseTotal(start: Date, end: Date): Promise<bigint> {
    const agg = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'EXPENSE',
        deletedAt: null,
        occurredAt: { gte: start, lte: end },
      },
    });
    return agg._sum.amount ?? BigInt(0);
  }

  private async getMonthlyExpenseByCategory(
    start: Date,
    end: Date,
  ): Promise<Array<{ name: string; total: string }>> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        type: 'EXPENSE',
        deletedAt: null,
        occurredAt: { gte: start, lte: end },
        categoryId: { not: null },
      },
      _sum: { amount: true },
    });

    if (groups.length === 0) return [];

    const categoryIds = groups.map((g) => g.categoryId).filter((id): id is number => id != null);
    const categories = await this.prisma.transactionCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    const byId = new Map(categories.map((c) => [c.id, c.name]));

    const result = groups.map((g) => ({
      name: byId.get(g.categoryId!) ?? 'بدون دسته',
      total: String(g._sum.amount ?? 0),
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
