import { Injectable, BadRequestException } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as jalaali from 'jalaali-js';

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
const SETTLED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.PAID,
  AppointmentStatus.SETTLED,
];

export interface EmployeeSalaryPreviewParams {
  employeeId: number;
  fromJalali: string;
  toJalali: string;
  percentage: number;
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

export interface EmployeeSalaryPreviewResult {
  totalAppointments: number;
  totalRevenue: string;
  employeeShare: string;
  platformShare: string;
  breakdown: DailyBreakdown[] | WeeklyBreakdown[];
}

function normalizeDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const english = '0123456789';
  return (input || '').replace(/[۰-۹]/g, (d) => english[persian.indexOf(d)] ?? d);
}

/** Convert Jalali string to UTC Date range (Tehran day boundaries) */
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

/** Get Tehran date (jy, jm, jd) from UTC scheduledAt */
function scheduledAtToTehranDate(scheduledAt: Date): { jy: number; jm: number; jd: number } {
  const tehranMs = scheduledAt.getTime() + TEHRAN_OFFSET_MS;
  const d = new Date(tehranMs);
  const gy = d.getUTCFullYear();
  const gm = d.getUTCMonth() + 1;
  const gd = d.getUTCDate();
  const j = jalaali.toJalaali(gy, gm, gd);
  return { jy: j.jy, jm: j.jm, jd: j.jd };
}

function getISOWeek(d: Date): number {
  const temp = new Date(d.getTime());
  temp.setUTCHours(0, 0, 0, 0);
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
}

/**
 * Calculate employee salary preview (read-only, no DB mutation).
 * Future-compatible: reusable for Salary record creation, Transaction, period locking.
 */
export async function calculateEmployeeSalaryPreview(
  prisma: PrismaService,
  params: EmployeeSalaryPreviewParams,
): Promise<EmployeeSalaryPreviewResult> {
  const { employeeId, fromJalali, toJalali, percentage } = params;

  const from = normalizeDigits(fromJalali);
  const to = normalizeDigits(toJalali);

  const fromRange = jalaliToUtcRange(from);
  const toRange = jalaliToUtcRange(to);
  if (!fromRange || !toRange) {
    throw new BadRequestException('Invalid Jalali date format. Use YYYY/MM/DD or YYYY-MM-DD');
  }

  const start = fromRange.start;
  const end = toRange.end;
  if (start.getTime() > end.getTime()) {
    throw new BadRequestException('From date must be before or equal to to date');
  }

  const daysDiff =
    Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const useDailyBreakdown = daysDiff <= 10;

  const appointments = await prisma.appointment.findMany({
    where: {
      employeeId,
      status: { in: SETTLED_STATUSES },
      deletedAt: null,
      amount: { not: null },
      scheduledAt: { gte: start, lte: end },
    },
    select: { id: true, amount: true, scheduledAt: true },
  });

  let totalRevenue = 0n;
  for (const a of appointments) {
    totalRevenue += a.amount ?? 0n;
  }

  const totalAppointments = appointments.length;
  const percentageNum = Math.max(0, Math.min(100, percentage));
  const employeeShare = (totalRevenue * BigInt(Math.floor(percentageNum * 100))) / 10000n;
  const platformShare = totalRevenue - employeeShare;

  const breakdownMap = new Map<
    string,
    { count: number; revenue: bigint }
  >();

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
    const keys = Array.from(breakdownMap.keys()).sort();
    breakdown = keys.map((key) => {
      const v = breakdownMap.get(key)!;
      return { date: key, count: v.count, revenue: v.revenue.toString() };
    });
  } else {
    const keys = Array.from(breakdownMap.keys()).sort();
    breakdown = keys.map((key) => {
      const v = breakdownMap.get(key)!;
      const [jy, w] = key.split('-W');
      return {
        weekLabel: `هفته ${parseInt(w, 10)} سال ${jy}`,
        count: v.count,
        revenue: v.revenue.toString(),
      };
    });
  }

  return {
    totalAppointments,
    totalRevenue: totalRevenue.toString(),
    employeeShare: employeeShare.toString(),
    platformShare: platformShare.toString(),
    breakdown,
  };
}

@Injectable()
export class EmployeeSalaryService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(params: EmployeeSalaryPreviewParams): Promise<EmployeeSalaryPreviewResult> {
    return calculateEmployeeSalaryPreview(this.prisma, params);
  }
}
