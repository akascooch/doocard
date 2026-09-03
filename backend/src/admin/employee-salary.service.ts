import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  EmployeeCommissionSettlementStatus,
  EmployeeCommissionSettlementTransactionRole,
  Prisma,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as jalaali from 'jalaali-js';
import {
  COMMISSION_SETTLEMENT_SOURCE_TYPE,
  DEFAULT_COMMISSION_PERCENTAGE,
  EMPLOYEE_EXPENSE_CATEGORY_CODES,
  CANONICAL_EMPLOYEE_WITHDRAWAL_CATEGORY_ID,
  SPECIAL_COMMISSION_POLICY,
  DEFAULT_COMMISSION_POLICY,
  commissionPolicyTaxRial,
  computeAppointmentCommissionShare,
} from '../common/constants/employee-commission.constants';
import { CommitEmployeeCommissionSettlementDto } from './dto/commit-employee-commission-settlement.dto';

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
const MAX_SALARY_PREVIEW_RANGE_DAYS = 90;
const SETTLED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.PAID,
  AppointmentStatus.SETTLED,
];

export interface EmployeeSalaryPreviewParams {
  employeeId: number;
  fromJalali: string;
  toJalali: string;
  percentage?: number;
}

export interface PriorWithdrawalRow {
  id: number;
  amount: string;
  occurredAt: string;
  description: string | null;
  categoryName: string | null;
  sourceType: string | null;
}

export interface DailyBreakdown {
  date: string;
  count: number;
  revenue: string;
}

export interface WeeklyBreakdown {
  weekLabel: string;
  count: number;
  revenue: string;
}

export interface EmployeeSalaryPreviewAppointmentItem {
  id: number;
  scheduledAt: string;
  scheduledAtJalali: string;
  status: string;
  amountRial: string;
  customerName: string;
  /** Per-appointment tax applied (IRR). */
  taxApplied: string;
  /** Per-appointment employee net share after policy tax/split (IRR). */
  netShare: string;
}

/** Per-tip attribution line for SERVICE staff salary preview (additive). */
export interface ServiceTipLineItem {
  allocationId: number;
  /** Appointment id for appointment-origin tips; null for manual tips. */
  appointmentId: number | null;
  tipSourceId?: number | null;
  origin?: 'APPOINTMENT' | 'MANUAL';
  paidAt: string | null;
  paidAtJalali?: string | null;
  scheduledAt?: string | null;
  scheduledAtJalali?: string | null;
  barberEmployeeId: number | null;
  barberName: string;
  tipRecipientType: 'INDIVIDUAL' | 'TEAM' | null;
  tipAmountTotalRial: string;
  myShareRial: string;
  originLabel: string;
  serviceNames?: string[];
  customerName?: string | null;
}

export interface EmployeeSalaryPreviewResult {
  periodFromJalali: string;
  periodToJalali: string;
  totalAppointments: number;
  totalRevenue: string;
  employeeShare: string;
  platformShare: string;
  payoutGrossBeforeDeduction: string;
  deductionPerAppointmentAmount: string;
  totalDeduction: string;
  payoutNetAfterDeduction: string;
  priorWithdrawalsTotal: string;
  /**
   * Withdrawable for salary requests / employee UI.
   * BARBER: appointment commission net only (excludes TEAM tips).
   * SERVICE: tip income minus prior withdrawals (unchanged).
   */
  netPayable: string;
  /**
   * Admin direct-settlement payout total.
   * BARBER (EMPLOYEE): equals netPayable — tips are exclusive to SERVICE staff.
   * SERVICE: equals netPayable (tips are the payroll basis — no double-count).
   */
  settlementPayable: string;
  lastCommissionSettlementAt: string | null;
  suggestedPeriodStartJalali: string | null;
  commissionPercentageUsed: number;
  priorWithdrawals: PriorWithdrawalRow[];
  excludedAlreadySettledAppointments: number;
  breakdown: DailyBreakdown[] | WeeklyBreakdown[];
  employeeRole: string;
  isServiceStaff: boolean;
  totalTipIncome: string;
  tipAllocationCount: number;
  /**
   * TEAM tip share income.
   * Always '0' for barbers (EMPLOYEE) — tips are exclusive to SERVICE staff.
   * SERVICE path keeps teamShareIncome at '0' and uses totalTipIncome instead.
   */
  teamShareIncome: string;
  appointments: EmployeeSalaryPreviewAppointmentItem[];
  /** SERVICE-only: per-tip attribution lines (absent/empty for barbers). */
  tipLines?: ServiceTipLineItem[];
  /** True when Employee.isSpecialCommission — uses SPECIAL_COMMISSION_POLICY. */
  isSpecialCommission: boolean;
}

export interface SettlementHistoryItem {
  id: number;
  employeeId: number;
  periodStartJalali: string | null;
  periodEndJalali: string | null;
  periodStartAt: string;
  periodEndAt: string;
  appointmentCount: number;
  netPayableRial: string;
  status: EmployeeCommissionSettlementStatus;
  settledAt: string;
  reversedAt: string | null;
}

function normalizeDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const english = '0123456789';
  return (input || '').replace(/[۰-۹]/g, (d) => english[persian.indexOf(d)] ?? d);
}

function jalaliToUtcRange(jalaliStr: string): { start: Date; end: Date } | null {
  const g = parseJalali(jalaliStr);
  if (!g) return null;
  const start = new Date(
    Date.UTC(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0) - TEHRAN_OFFSET_MS,
  );
  const end = new Date(
    Date.UTC(g.gy, g.gm - 1, g.gd, 23, 59, 59, 999) - TEHRAN_OFFSET_MS,
  );
  return { start, end };
}

function parseJalali(jalaliStr: string): { gy: number; gm: number; gd: number } | null {
  const normalized = (jalaliStr || '').trim().replace(/-/g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  return jalaali.toGregorian(jy, jm, jd);
}

function scheduledAtToTehranDate(scheduledAt: Date): { jy: number; jm: number; jd: number } {
  const tehranMs = scheduledAt.getTime() + TEHRAN_OFFSET_MS;
  const d = new Date(tehranMs);
  const gy = d.getUTCFullYear();
  const gm = d.getUTCMonth() + 1;
  const gd = d.getUTCDate();
  const j = jalaali.toJalaali(gy, gm, gd);
  return { jy: j.jy, jm: j.jm, jd: j.jd };
}

function formatJalaliFromDate(d: Date): string {
  const { jy, jm, jd } = scheduledAtToTehranDate(d);
  return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
}

function assertValidPreviewDateRange(
  fromJalali: string,
  toJalali: string,
  maxDays?: number,
): {
  from: string;
  to: string;
  periodStartExclusive: Date;
  periodEndInclusive: Date;
} {
  const from = normalizeDigits(fromJalali);
  const to = normalizeDigits(toJalali);
  const fromRange = jalaliToUtcRange(from);
  const toRange = jalaliToUtcRange(to);
  if (!fromRange || !toRange) {
    throw new BadRequestException('Invalid Jalali date format. Use YYYY/MM/DD or YYYY-MM-DD');
  }
  if (fromRange.start.getTime() > toRange.end.getTime()) {
    throw new BadRequestException('From date must be before or equal to to date');
  }
  if (maxDays !== undefined) {
    const daysDiff =
      Math.ceil(
        (toRange.end.getTime() - fromRange.start.getTime()) / (24 * 60 * 60 * 1000),
      ) + 1;
    if (daysDiff > maxDays) {
      throw new BadRequestException(`Date range must not exceed ${maxDays} days`);
    }
  }
  return {
    from,
    to,
    periodStartExclusive: fromRange.start,
    periodEndInclusive: toRange.end,
  };
}

function getISOWeek(d: Date): number {
  const temp = new Date(d.getTime());
  temp.setUTCHours(0, 0, 0, 0);
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function resolveCommissionPercentage(
  employeeRate: number,
  override?: number,
  isSpecialCommission = false,
): number {
  if (isSpecialCommission) {
    return Math.round(SPECIAL_COMMISSION_POLICY.split * 100);
  }
  if (override !== undefined && !isNaN(override)) {
    return Math.max(0, Math.min(100, override));
  }
  if (employeeRate > 0) return Math.max(0, Math.min(100, employeeRate));
  return DEFAULT_COMMISSION_PERCENTAGE;
}

async function getConsumedWithdrawalTransactionIds(
  prisma: PrismaService,
): Promise<number[]> {
  const rows = await prisma.employeeCommissionSettlementTransaction.findMany({
    where: {
      role: EmployeeCommissionSettlementTransactionRole.PRIOR_WITHDRAWAL,
      settlement: { status: EmployeeCommissionSettlementStatus.ACTIVE },
    },
    select: { transactionId: true },
  });
  return rows.map((r) => r.transactionId);
}

async function getSettledAppointmentIds(
  prisma: PrismaService,
  employeeId: number,
): Promise<number[]> {
  const rows = await prisma.employeeCommissionSettlementAppointment.findMany({
    where: {
      settlement: {
        employeeId,
        status: EmployeeCommissionSettlementStatus.ACTIVE,
      },
    },
    select: { appointmentId: true },
  });
  return rows.map((r) => r.appointmentId);
}

async function findPriorWithdrawals(
  prisma: PrismaService,
  employeeId: number,
  periodStartExclusive: Date,
  periodEndInclusive: Date,
  consumedIds: number[],
) {
  const employeeCategoryIds = await prisma.transactionCategory.findMany({
    where: {
      deletedAt: null,
      OR: [
        { code: { in: [...EMPLOYEE_EXPENSE_CATEGORY_CODES] } },
        { requiresEmployee: true },
      ],
    },
    select: { id: true },
  });
  const categoryIds = employeeCategoryIds.map((c) => c.id);

  const salaryIds = (
    await prisma.salary.findMany({
      where: { employeeId },
      select: { id: true },
    })
  ).map((s) => s.id);

  return prisma.transaction.findMany({
    where: {
      deletedAt: null,
      type: TransactionType.EXPENSE,
      NOT: { type: TransactionType.TIP },
      occurredAt: { gt: periodStartExclusive, lte: periodEndInclusive },
      id: { notIn: consumedIds },
      OR: [
        { employeeId },
        ...(salaryIds.length
          ? [{ sourceType: 'SALARY', sourceId: { in: salaryIds } }]
          : []),
        ...(categoryIds.length
          ? [{ categoryId: { in: categoryIds }, employeeId }]
          : []),
      ],
      AND: [
        {
          OR: [
            { sourceType: null },
            { sourceType: { not: COMMISSION_SETTLEMENT_SOURCE_TYPE } },
          ],
        },
      ],
    },
    include: { category: true },
    orderBy: { occurredAt: 'asc' },
  });
}

export async function calculateEmployeeSalaryPreview(
  prisma: PrismaService,
  params: EmployeeSalaryPreviewParams,
): Promise<EmployeeSalaryPreviewResult> {
  const { employeeId, fromJalali, toJalali, percentage } = params;

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { user: true },
  });
  if (!employee) {
    throw new NotFoundException('Employee not found');
  }

  const {
    from,
    to,
    periodStartExclusive,
    periodEndInclusive,
  } = assertValidPreviewDateRange(fromJalali, toJalali);

  const lastSettlement = await prisma.employeeCommissionSettlement.findFirst({
    where: {
      employeeId,
      status: EmployeeCommissionSettlementStatus.ACTIVE,
    },
    orderBy: { periodEndAt: 'desc' },
  });

  const settledAppointmentIds = await getSettledAppointmentIds(prisma, employeeId);
  const consumedWithdrawalIds = await getConsumedWithdrawalTransactionIds(prisma);

  const isServiceStaff = employee.user.role === 'SERVICE';
  const isSpecialCommission = Boolean(employee.isSpecialCommission);
  const percentageNum = resolveCommissionPercentage(
    employee.commissionRate,
    percentage,
    isSpecialCommission,
  );

  if (isServiceStaff) {
    const tipAllocations = await prisma.appointmentTipAllocation.findMany({
      where: {
        employeeId,
        paidInSettlementId: null,
        appointment: {
          status: { in: SETTLED_STATUSES },
          deletedAt: null,
          paidAt: { gt: periodStartExclusive, lte: periodEndInclusive },
        },
      },
      include: {
        appointment: {
          select: {
            id: true,
            paidAt: true,
            scheduledAt: true,
            tipAmount: true,
            tipRecipientType: true,
            employeeId: true,
            employee: {
              select: {
                id: true,
                user: { select: { name: true } },
              },
            },
            customer: {
              select: { user: { select: { name: true } } },
            },
            appointmentServices: {
              select: { service: { select: { name: true } } },
            },
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const manualTipAllocations = await prisma.manualTipAllocation.findMany({
      where: {
        employeeId,
        paidInSettlementId: null,
        tipSource: {
          status: 'ACTIVE',
          effectiveBusinessAt: {
            gt: periodStartExclusive,
            lte: periodEndInclusive,
          },
        },
      },
      include: {
        tipSource: {
          select: {
            id: true,
            tipType: true,
            amountRial: true,
            effectiveBusinessAt: true,
            note: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    let totalTipIncome = 0n;
    for (const row of tipAllocations) {
      totalTipIncome += row.amountRial;
    }
    for (const row of manualTipAllocations) {
      totalTipIncome += row.amountRial;
    }

    const tipLines: ServiceTipLineItem[] = tipAllocations.map((row) => {
      const apt = row.appointment;
      const barberEmployeeId = apt.employee?.id ?? apt.employeeId ?? null;
      const barberName = apt.employee?.user?.name?.trim() || 'نامشخص';
      const tipType =
        apt.tipRecipientType === 'INDIVIDUAL' || apt.tipRecipientType === 'TEAM'
          ? apt.tipRecipientType
          : null;
      const tipTotal = apt.tipAmount ?? 0n;
      const myShare = row.amountRial;
      const originLabel =
        tipType === 'TEAM'
          ? `سهم انعام تیمی از نوبت #${apt.id} — آرایشگر: ${barberName}`
          : tipType === 'INDIVIDUAL'
            ? `انعام فردی از نوبت #${apt.id} — آرایشگر: ${barberName}`
            : `انعام از نوبت #${apt.id} — آرایشگر: ${barberName}`;

      const serviceNames = [
        ...(apt.service?.name ? [apt.service.name] : []),
        ...(apt.appointmentServices || [])
          .map((as) => as.service?.name)
          .filter((n): n is string => Boolean(n)),
      ].filter((name, idx, arr) => arr.indexOf(name) === idx);

      return {
        allocationId: row.id,
        appointmentId: apt.id,
        tipSourceId: null,
        origin: 'APPOINTMENT' as const,
        paidAt: apt.paidAt ? apt.paidAt.toISOString() : null,
        paidAtJalali: apt.paidAt ? formatJalaliFromDate(apt.paidAt) : null,
        scheduledAt: apt.scheduledAt ? apt.scheduledAt.toISOString() : null,
        scheduledAtJalali: apt.scheduledAt
          ? formatJalaliFromDate(apt.scheduledAt)
          : null,
        barberEmployeeId,
        barberName,
        tipRecipientType: tipType,
        tipAmountTotalRial: tipTotal.toString(),
        myShareRial: myShare.toString(),
        originLabel,
        serviceNames,
        customerName: apt.customer?.user?.name ?? null,
      };
    });

    for (const row of manualTipAllocations) {
      const src = row.tipSource;
      const tipType =
        src.tipType === 'INDIVIDUAL' || src.tipType === 'TEAM' ? src.tipType : null;
      tipLines.push({
        allocationId: row.id,
        appointmentId: null,
        tipSourceId: src.id,
        origin: 'MANUAL',
        paidAt: src.effectiveBusinessAt.toISOString(),
        paidAtJalali: formatJalaliFromDate(src.effectiveBusinessAt),
        scheduledAt: null,
        scheduledAtJalali: null,
        barberEmployeeId: null,
        barberName: '—',
        tipRecipientType: tipType,
        tipAmountTotalRial: src.amountRial.toString(),
        myShareRial: row.amountRial.toString(),
        originLabel:
          tipType === 'TEAM'
            ? `انعام تیمی دستی #${src.id}`
            : `انعام فردی دستی #${src.id}`,
        serviceNames: [],
        customerName: src.note ?? null,
      });
    }

    const priorWithdrawalRows = await findPriorWithdrawals(
      prisma,
      employeeId,
      periodStartExclusive,
      periodEndInclusive,
      consumedWithdrawalIds,
    );

    let priorWithdrawalsTotal = 0n;
    for (const tx of priorWithdrawalRows) {
      if (tx.type === TransactionType.TIP) continue;
      priorWithdrawalsTotal += tx.amount;
    }

    const netPayable = totalTipIncome - priorWithdrawalsTotal;
    // SERVICE: settlement payout is tip-basis net — same as netPayable (do not add tips twice).
    const settlementPayable = netPayable;
    const breakdownMap = new Map<string, { count: number; revenue: bigint }>();
    for (const row of tipAllocations) {
      const paidAt = row.appointment.paidAt ?? row.appointment.scheduledAt;
      const { jy, jm, jd } = scheduledAtToTehranDate(paidAt);
      const key = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
      const existing = breakdownMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.revenue += row.amountRial;
      } else {
        breakdownMap.set(key, { count: 1, revenue: row.amountRial });
      }
    }
    for (const row of manualTipAllocations) {
      const { jy, jm, jd } = scheduledAtToTehranDate(row.tipSource.effectiveBusinessAt);
      const key = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
      const existing = breakdownMap.get(key);
      if (existing) {
        existing.count += 1;
        existing.revenue += row.amountRial;
      } else {
        breakdownMap.set(key, { count: 1, revenue: row.amountRial });
      }
    }

    const breakdown: DailyBreakdown[] = Array.from(breakdownMap.keys())
      .sort()
      .map((key) => {
        const v = breakdownMap.get(key)!;
        return { date: key, count: v.count, revenue: v.revenue.toString() };
      });

    return {
      periodFromJalali: from,
      periodToJalali: to,
      totalAppointments: 0,
      totalRevenue: '0',
      employeeShare: totalTipIncome.toString(),
      platformShare: '0',
      payoutGrossBeforeDeduction: totalTipIncome.toString(),
      deductionPerAppointmentAmount: '0',
      totalDeduction: '0',
      payoutNetAfterDeduction: totalTipIncome.toString(),
      priorWithdrawalsTotal: priorWithdrawalsTotal.toString(),
      netPayable: netPayable.toString(),
      settlementPayable: settlementPayable.toString(),
      lastCommissionSettlementAt:
        lastSettlement?.periodEndAt.toISOString() ??
        employee.lastCommissionSettlementAt?.toISOString() ??
        null,
      suggestedPeriodStartJalali: lastSettlement?.periodEndJalali ?? null,
      commissionPercentageUsed: 0,
      priorWithdrawals: priorWithdrawalRows
        .filter((tx) => tx.type !== TransactionType.TIP)
        .map((tx) => ({
          id: tx.id,
          amount: tx.amount.toString(),
          occurredAt: tx.occurredAt.toISOString(),
          description: tx.description,
          categoryName: tx.category?.name ?? null,
          sourceType: tx.sourceType,
        })),
      excludedAlreadySettledAppointments: 0,
      breakdown,
      employeeRole: employee.user.role,
      isServiceStaff: true,
      totalTipIncome: totalTipIncome.toString(),
      tipAllocationCount: tipAllocations.length + manualTipAllocations.length,
      teamShareIncome: '0',
      appointments: [],
      tipLines,
      isSpecialCommission: false,
    };
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      employeeId,
      status: { in: SETTLED_STATUSES },
      deletedAt: null,
      amount: { not: null },
      financiallyLockedAt: null,
      id: { notIn: settledAppointmentIds },
      scheduledAt: { gt: periodStartExclusive, lte: periodEndInclusive },
    },
    select: {
      id: true,
      amount: true,
      scheduledAt: true,
      status: true,
      customer: { select: { user: { select: { name: true } } } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  const percentageNumBarber = percentageNum;
  const policy = isSpecialCommission
    ? SPECIAL_COMMISSION_POLICY
    : DEFAULT_COMMISSION_POLICY;
  const deductionPerAppointmentAmount = commissionPolicyTaxRial(policy);

  let totalRevenue = 0n;
  let totalDeduction = 0n;
  let employeeShareGross = 0n;
  let payoutNetAfterDeduction = 0n;
  const perAppointmentShares: {
    taxAppliedRial: bigint;
    grossShareRial: bigint;
    netShareRial: bigint;
  }[] = [];

  for (const a of appointments) {
    const amount = a.amount ?? 0n;
    totalRevenue += amount;
    const share = computeAppointmentCommissionShare(
      amount,
      isSpecialCommission,
      isSpecialCommission ? undefined : percentageNumBarber,
    );
    perAppointmentShares.push({
      taxAppliedRial: share.taxAppliedRial,
      grossShareRial: share.grossShareRial,
      netShareRial: share.netShareRial,
    });
    totalDeduction += share.taxAppliedRial;
    employeeShareGross += share.grossShareRial;
    payoutNetAfterDeduction += share.netShareRial;
  }

  const totalAppointments = appointments.length;
  /**
   * Special: grossShare already equals netShare ((amount − tax) × 50%).
   * Default: grossShare is amount × %, net = gross − tax.
   * employeeShare field = pre-withdrawal employee portion used in reports:
   *   special → sum(netShare); default → sum(grossShare).
   */
  const employeeShare = isSpecialCommission
    ? payoutNetAfterDeduction
    : employeeShareGross;
  const platformShare = isSpecialCommission
    ? totalRevenue - totalDeduction - employeeShare
    : totalRevenue - employeeShareGross;

  // Business rule: tips are exclusive to SERVICE staff.
  // Barber (EMPLOYEE) payroll ignores TEAM tip allocations entirely.
  const teamShareIncome = 0n;

  const priorWithdrawalRows = await findPriorWithdrawals(
    prisma,
    employeeId,
    periodStartExclusive,
    periodEndInclusive,
    consumedWithdrawalIds,
  );

  let priorWithdrawalsTotal = 0n;
  for (const tx of priorWithdrawalRows) {
    if (tx.type === TransactionType.TIP) continue;
    priorWithdrawalsTotal += tx.amount;
  }

  // Barber netPayable / settlementPayable: appointment commission net only.
  // Negative values are intentional (debt / over-withdrawn) and must not be clamped.
  const netPayable = payoutNetAfterDeduction - priorWithdrawalsTotal;
  const settlementPayable = netPayable;

  const daysDiff =
    Math.ceil(
      (periodEndInclusive.getTime() - periodStartExclusive.getTime()) /
        (24 * 60 * 60 * 1000),
    ) + 1;
  const useDailyBreakdown = daysDiff <= 10;

  const breakdownMap = new Map<string, { count: number; revenue: bigint }>();
  for (const a of appointments) {
    const { jy, jm, jd } = scheduledAtToTehranDate(a.scheduledAt);
    const amount = a.amount ?? 0n;
    let key: string;
    if (useDailyBreakdown) {
      key = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
    } else {
      const d = new Date(a.scheduledAt.getTime() + TEHRAN_OFFSET_MS);
      const weekNum = getISOWeek(d);
      const weekYear = d.getUTCFullYear();
      const j = jalaali.toJalaali(weekYear, d.getUTCMonth() + 1, d.getUTCDate());
      key = `${j.jy}-W${String(weekNum).padStart(2, '0')}`;
    }
    const existing = breakdownMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.revenue += amount;
    } else {
      breakdownMap.set(key, { count: 1, revenue: amount });
    }
  }

  let breakdown: DailyBreakdown[] | WeeklyBreakdown[];
  if (useDailyBreakdown) {
    breakdown = Array.from(breakdownMap.keys())
      .sort()
      .map((key) => {
        const v = breakdownMap.get(key)!;
        return { date: key, count: v.count, revenue: v.revenue.toString() };
      });
  } else {
    breakdown = Array.from(breakdownMap.keys())
      .sort()
      .map((key) => {
        const v = breakdownMap.get(key)!;
        const [, w] = key.split('-W');
        const [jy] = key.split('-W');
        return {
          weekLabel: `هفته ${parseInt(w, 10)} سال ${jy}`,
          count: v.count,
          revenue: v.revenue.toString(),
        };
      });
  }

  const excludedAlreadySettledAppointments = await prisma.appointment.count({
    where: {
      employeeId,
      status: { in: SETTLED_STATUSES },
      deletedAt: null,
      amount: { not: null },
      scheduledAt: { gt: periodStartExclusive, lte: periodEndInclusive },
      OR: [
        { id: { in: settledAppointmentIds } },
        { financiallyLockedAt: { not: null } },
      ],
    },
  });

  const appointmentRows: EmployeeSalaryPreviewAppointmentItem[] = appointments.map(
    (a, idx) => {
      const share = perAppointmentShares[idx]!;
      return {
        id: a.id,
        scheduledAt: a.scheduledAt.toISOString(),
        scheduledAtJalali: formatJalaliFromDate(a.scheduledAt),
        status: a.status,
        amountRial: (a.amount ?? 0n).toString(),
        customerName: a.customer?.user?.name ?? 'مشتری',
        taxApplied: share.taxAppliedRial.toString(),
        netShare: share.netShareRial.toString(),
      };
    },
  );

  return {
    periodFromJalali: from,
    periodToJalali: to,
    totalAppointments,
    totalRevenue: totalRevenue.toString(),
    employeeShare: employeeShare.toString(),
    platformShare: platformShare.toString(),
    payoutGrossBeforeDeduction: employeeShareGross.toString(),
    deductionPerAppointmentAmount: deductionPerAppointmentAmount.toString(),
    totalDeduction: totalDeduction.toString(),
    payoutNetAfterDeduction: payoutNetAfterDeduction.toString(),
    priorWithdrawalsTotal: priorWithdrawalsTotal.toString(),
    netPayable: netPayable.toString(),
    settlementPayable: settlementPayable.toString(),
    lastCommissionSettlementAt:
      lastSettlement?.periodEndAt.toISOString() ??
      employee.lastCommissionSettlementAt?.toISOString() ??
      null,
    suggestedPeriodStartJalali: lastSettlement?.periodEndJalali ?? null,
    commissionPercentageUsed: percentageNumBarber,
    priorWithdrawals: priorWithdrawalRows
      .filter((tx) => tx.type !== TransactionType.TIP)
      .map((tx) => ({
        id: tx.id,
        amount: tx.amount.toString(),
        occurredAt: tx.occurredAt.toISOString(),
        description: tx.description,
        categoryName: tx.category?.name ?? null,
        sourceType: tx.sourceType,
      })),
    excludedAlreadySettledAppointments,
    breakdown,
    employeeRole: employee.user.role,
    isServiceStaff: false,
    totalTipIncome: '0',
    tipAllocationCount: 0,
    teamShareIncome: '0',
    appointments: appointmentRows,
    isSpecialCommission,
  };
}

@Injectable()
export class EmployeeSalaryService {
  constructor(private readonly prisma: PrismaService) {}

  async previewForAuthenticatedEmployee(
    userId: number,
    fromJalali: string,
    toJalali: string,
  ): Promise<EmployeeSalaryPreviewResult> {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (!employee) {
      throw new NotFoundException('پروفایل کارمند یافت نشد');
    }
    if (employee.user.role !== 'EMPLOYEE' && employee.user.role !== 'SERVICE') {
      throw new ForbiddenException(
        'این بخش فقط برای آرایشگران و پرسنل خدمات در دسترس است',
      );
    }

    assertValidPreviewDateRange(fromJalali, toJalali, MAX_SALARY_PREVIEW_RANGE_DAYS);

    return calculateEmployeeSalaryPreview(this.prisma, {
      employeeId: employee.id,
      fromJalali,
      toJalali,
    });
  }

  async preview(params: EmployeeSalaryPreviewParams): Promise<EmployeeSalaryPreviewResult> {
    return calculateEmployeeSalaryPreview(this.prisma, params);
  }

  async getSettlementHistory(employeeId: number): Promise<SettlementHistoryItem[]> {
    const rows = await this.prisma.employeeCommissionSettlement.findMany({
      where: { employeeId },
      orderBy: { settledAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      periodStartJalali: r.periodStartJalali,
      periodEndJalali: r.periodEndJalali,
      periodStartAt: r.periodStartAt.toISOString(),
      periodEndAt: r.periodEndAt.toISOString(),
      appointmentCount: r.appointmentCount,
      netPayableRial: r.netPayableRial.toString(),
      status: r.status,
      settledAt: r.settledAt.toISOString(),
      reversedAt: r.reversedAt?.toISOString() ?? null,
    }));
  }

  async commitSettlement(
    dto: CommitEmployeeCommissionSettlementDto,
    adminUserId: number,
  ) {
    if (!dto.periodStartConfirmed) {
      throw new BadRequestException('تأیید تاریخ شروع دوره (آخرین تسویه) الزامی است');
    }

    const preview = await calculateEmployeeSalaryPreview(this.prisma, {
      employeeId: dto.employeeId,
      fromJalali: dto.fromJalali,
      toJalali: dto.toJalali,
      percentage: dto.commissionPercentage,
    });

    const appointmentNetPayable = BigInt(preview.netPayable);
    const teamShareIncome = BigInt(preview.teamShareIncome);
    const settlementPayable = BigInt(preview.settlementPayable);
    // Negative settlementPayable is allowed and persisted as employee debt / over-withdrawal.
    const isServiceStaff = preview.isServiceStaff;
    const isSpecialCommission = Boolean(preview.isSpecialCommission);
    if (!isServiceStaff && preview.totalAppointments === 0) {
      throw new BadRequestException('نوبت یا مبلغ قابل تسویه در این بازه وجود ندارد');
    }
    if (isServiceStaff && preview.tipAllocationCount === 0 && settlementPayable === 0n) {
      throw new BadRequestException('انعام قابل تسویه در این بازه وجود ندارد');
    }

    const fromRange = jalaliToUtcRange(normalizeDigits(dto.fromJalali));
    const toRange = jalaliToUtcRange(normalizeDigits(dto.toJalali));
    if (!fromRange || !toRange) {
      throw new BadRequestException('Invalid Jalali date range');
    }

    const lastActive = await this.prisma.employeeCommissionSettlement.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: EmployeeCommissionSettlementStatus.ACTIVE,
      },
      orderBy: { periodEndAt: 'desc' },
    });

    if (lastActive?.periodEndJalali && lastActive.periodEndJalali !== normalizeDigits(dto.fromJalali)) {
      throw new BadRequestException(
        'تاریخ شروع دوره با آخرین تسویه فعال همخوانی ندارد',
      );
    }

    const settledAppointmentIds = await getSettledAppointmentIds(
      this.prisma,
      dto.employeeId,
    );
    const consumedWithdrawalIds = await getConsumedWithdrawalTransactionIds(this.prisma);

    const appointments = isServiceStaff
      ? []
      : await this.prisma.appointment.findMany({
          where: {
            employeeId: dto.employeeId,
            status: { in: SETTLED_STATUSES },
            deletedAt: null,
            amount: { not: null },
            financiallyLockedAt: null,
            id: { notIn: settledAppointmentIds },
            scheduledAt: { gt: fromRange.start, lte: toRange.end },
          },
          select: { id: true, amount: true },
        });

    // Tips are exclusive to SERVICE staff — never include TEAM tip allocations in barber settlements.
    const tipAllocations = isServiceStaff
      ? await this.prisma.appointmentTipAllocation.findMany({
          where: {
            employeeId: dto.employeeId,
            paidInSettlementId: null,
            appointment: {
              status: { in: SETTLED_STATUSES },
              deletedAt: null,
              paidAt: { gt: fromRange.start, lte: toRange.end },
            },
          },
          select: { id: true, amountRial: true, appointmentId: true },
        })
      : [];

    const manualTipAllocations = isServiceStaff
      ? await this.prisma.manualTipAllocation.findMany({
          where: {
            employeeId: dto.employeeId,
            paidInSettlementId: null,
            tipSource: {
              status: 'ACTIVE',
              effectiveBusinessAt: {
                gt: fromRange.start,
                lte: toRange.end,
              },
            },
          },
          select: { id: true, amountRial: true, tipSourceId: true },
        })
      : [];

    // Use canonical withdrawal category for settlement expense when COMMISSION_SETTLEMENT missing
    let commissionCategoryId = dto.categoryId;
    if (!commissionCategoryId) {
      const cat = await this.prisma.transactionCategory.findFirst({
        where: { code: 'COMMISSION_SETTLEMENT', deletedAt: null, isActive: true },
      });
      commissionCategoryId = cat?.id;
    }
    if (!commissionCategoryId) {
      commissionCategoryId = CANONICAL_EMPLOYEE_WITHDRAWAL_CATEGORY_ID;
    }

    const priorWithdrawals = await findPriorWithdrawals(
      this.prisma,
      dto.employeeId,
      fromRange.start,
      toRange.end,
      consumedWithdrawalIds,
    );

    const percentageNum = preview.commissionPercentageUsed;
    const deductionPerAppointment = isSpecialCommission
      ? commissionPolicyTaxRial(SPECIAL_COMMISSION_POLICY)
      : commissionPolicyTaxRial(DEFAULT_COMMISSION_POLICY);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      const settlement = await tx.employeeCommissionSettlement.create({
        data: {
          employeeId: dto.employeeId,
          periodStartAt: fromRange.start,
          periodEndAt: toRange.end,
          periodStartJalali: normalizeDigits(dto.fromJalali),
          periodEndJalali: normalizeDigits(dto.toJalali),
          commissionPercentage: isServiceStaff ? 0 : percentageNum,
          appointmentCount: isServiceStaff ? tipAllocations.length : appointments.length,
          grossAppointmentTotalRial: BigInt(
            isServiceStaff ? preview.totalTipIncome : preview.totalRevenue,
          ),
          grossEmployeeShareRial: BigInt(preview.payoutGrossBeforeDeduction),
          deductionPerAppointmentRial: isServiceStaff
            ? 0n
            : deductionPerAppointment,
          totalAppointmentDeductionRial: BigInt(
            isServiceStaff ? '0' : preview.totalDeduction,
          ),
          priorWithdrawalsTotalRial: BigInt(preview.priorWithdrawalsTotal),
          // Persisted payout amount — may be negative (employee debt).
          netPayableRial: settlementPayable,
          createdByUserId: adminUserId,
          notes: dto.notes,
          status: EmployeeCommissionSettlementStatus.ACTIVE,
        },
      });

      for (const apt of appointments) {
        const amount = apt.amount ?? 0n;
        const share = computeAppointmentCommissionShare(
          amount,
          isSpecialCommission,
          isSpecialCommission ? undefined : percentageNum,
        );
        await tx.employeeCommissionSettlementAppointment.create({
          data: {
            settlementId: settlement.id,
            appointmentId: apt.id,
            appointmentAmountRial: amount,
            // Store pre-tax split share for default; net share for special (already tax-adjusted).
            employeeShareRial: share.grossShareRial,
            appointmentDeductionRial: share.taxAppliedRial,
          },
        });
        await tx.appointment.update({
          where: { id: apt.id },
          data: { financiallyLockedAt: now },
        });
      }

      // Mark tip allocations paid only for SERVICE payroll.
      // Barbers never include TEAM tips in settlement payout.
      let tipSumIncluded = 0n;
      for (const t of tipAllocations) {
        tipSumIncluded += t.amountRial;
      }
      for (const t of manualTipAllocations) {
        tipSumIncluded += t.amountRial;
      }
      if (isServiceStaff && tipSumIncluded !== BigInt(preview.totalTipIncome)) {
        throw new BadRequestException(
          'انعام بین پیش‌نمایش و تسویه تغییر کرده است؛ پیش‌نمایش را دوباره بگیرید',
        );
      }

      const tipsIncludedInPayout =
        isServiceStaff &&
        (tipAllocations.length > 0 || manualTipAllocations.length > 0);

      if (tipsIncludedInPayout) {
        if (tipAllocations.length > 0) {
          await tx.appointmentTipAllocation.updateMany({
            where: { id: { in: tipAllocations.map((t) => t.id) } },
            data: { paidInSettlementId: settlement.id },
          });
        }
        if (manualTipAllocations.length > 0) {
          await tx.manualTipAllocation.updateMany({
            where: { id: { in: manualTipAllocations.map((t) => t.id) } },
            data: { paidInSettlementId: settlement.id },
          });
        }
      }

      for (const withdrawal of priorWithdrawals) {
        if (withdrawal.type === TransactionType.TIP) continue;
        await tx.employeeCommissionSettlementTransaction.create({
          data: {
            settlementId: settlement.id,
            transactionId: withdrawal.id,
            amountRial: withdrawal.amount,
            role: EmployeeCommissionSettlementTransactionRole.PRIOR_WITHDRAWAL,
          },
        });
      }

      let settlementTransactionId: number | null = null;
      if (settlementPayable > 0n) {
        const account = await tx.bankAccount.findFirst({
          where: { id: dto.bankAccountId, deletedAt: null },
        });
        if (!account) {
          throw new BadRequestException('حساب بانکی یافت نشد');
        }

        const expenseTx = await tx.transaction.create({
          data: {
            type: TransactionType.EXPENSE,
            amount: settlementPayable,
            currency: 'IRR',
            description: isServiceStaff
              ? `تسویه انعام پرسنل خدمات #${dto.employeeId} تا ${normalizeDigits(dto.toJalali)}`
              : `تسویه کمیسیون کارمند #${dto.employeeId} تا ${normalizeDigits(dto.toJalali)}`,
            categoryId: commissionCategoryId ?? undefined,
            accountId: dto.bankAccountId,
            employeeId: dto.employeeId,
            sourceType: COMMISSION_SETTLEMENT_SOURCE_TYPE,
            sourceId: settlement.id,
            paymentMethod: 'CASH',
            occurredAt: now,
            createdBy: adminUserId,
            meta: {
              settlementId: settlement.id,
              employeeId: dto.employeeId,
              appointmentNetPayable: appointmentNetPayable.toString(),
              teamShareIncome: teamShareIncome.toString(),
              settlementPayable: settlementPayable.toString(),
            } as Prisma.InputJsonValue,
          },
        });

        await tx.bankAccount.update({
          where: { id: dto.bankAccountId },
          data: { balance: { decrement: settlementPayable } },
        });

        await tx.employeeCommissionSettlementTransaction.create({
          data: {
            settlementId: settlement.id,
            transactionId: expenseTx.id,
            amountRial: settlementPayable,
            role: EmployeeCommissionSettlementTransactionRole.FINAL_SETTLEMENT,
          },
        });

        settlementTransactionId = expenseTx.id;

        await tx.employeeCommissionSettlement.update({
          where: { id: settlement.id },
          data: { settlementTransactionId: expenseTx.id },
        });
      }

      await tx.employee.update({
        where: { id: dto.employeeId },
        data: { lastCommissionSettlementAt: toRange.end },
      });

      return {
        settlementId: settlement.id,
        settlementTransactionId,
        /** @deprecated Prefer settlementPayable — kept as paid amount for older clients/scripts. */
        netPayable: settlementPayable.toString(),
        settlementPayable: settlementPayable.toString(),
        appointmentNetPayable: appointmentNetPayable.toString(),
        teamShareIncome: teamShareIncome.toString(),
        appointmentCount: isServiceStaff ? tipAllocations.length : appointments.length,
        priorWithdrawalsCount: priorWithdrawals.length,
        preview,
      };
    });
  }

  async reverseSettlement(settlementId: number, adminUserId: number) {
    const settlement = await this.prisma.employeeCommissionSettlement.findUnique({
      where: { id: settlementId },
      include: {
        appointments: true,
        priorTransactions: true,
        settlementTransaction: true,
      },
    });

    if (!settlement) {
      throw new NotFoundException('Settlement batch not found');
    }
    if (settlement.status !== EmployeeCommissionSettlementStatus.ACTIVE) {
      throw new BadRequestException('فقط تسویه‌های فعال قابل برگشت هستند');
    }

    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      if (settlement.settlementTransactionId && settlement.settlementTransaction) {
        const txn = settlement.settlementTransaction;
        if (txn.accountId && txn.deletedAt == null) {
          await tx.bankAccount.update({
            where: { id: txn.accountId },
            data: { balance: { increment: txn.amount } },
          });
        }
        await tx.transaction.update({
          where: { id: txn.id },
          data: { deletedAt: now },
        });
      }

      for (const link of settlement.appointments) {
        const otherActive =
          await tx.employeeCommissionSettlementAppointment.findFirst({
            where: {
              appointmentId: link.appointmentId,
              settlementId: { not: settlementId },
              settlement: { status: EmployeeCommissionSettlementStatus.ACTIVE },
            },
          });
        if (!otherActive) {
          await tx.appointment.update({
            where: { id: link.appointmentId },
            data: { financiallyLockedAt: null },
          });
        }
      }

      await tx.appointmentTipAllocation.updateMany({
        where: { paidInSettlementId: settlementId },
        data: { paidInSettlementId: null },
      });

      await tx.employeeCommissionSettlement.update({
        where: { id: settlementId },
        data: {
          status: EmployeeCommissionSettlementStatus.REVERSED,
          reversedAt: now,
          reversedByUserId: adminUserId,
        },
      });

      const latestActive = await tx.employeeCommissionSettlement.findFirst({
        where: {
          employeeId: settlement.employeeId,
          status: EmployeeCommissionSettlementStatus.ACTIVE,
        },
        orderBy: { periodEndAt: 'desc' },
      });

      await tx.employee.update({
        where: { id: settlement.employeeId },
        data: {
          lastCommissionSettlementAt: latestActive?.periodEndAt ?? null,
        },
      });

      return { message: 'Settlement reversed successfully', settlementId };
    });
  }
}
