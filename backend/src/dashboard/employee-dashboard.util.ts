import { AppointmentStatus } from '@prisma/client';
import { getJalaliMonthRanges } from '../common/utils/date-utils';
import {
  formatJalaliFromUtcInstant,
  gregorianYmdToTehranHalfOpenDay,
} from '../common/utils/tehran-business-day';

/** Settled / completed work that may carry a barber net snapshot. */
export const BARBER_DONE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.PAID,
  AppointmentStatus.SETTLED,
];

export const BARBER_PENDING_TODAY_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.PENDING_CONFIRMATION,
  AppointmentStatus.CONFIRMED,
];

export function resolveAuthUserId(
  user: { id?: number; sub?: number } | null | undefined,
): number | null {
  const raw = user?.id ?? user?.sub;
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function getTehranTodayYmd(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
}

export function getTehranDayRange(ymd: string): { start: Date; endExclusive: Date } {
  const range = gregorianYmdToTehranHalfOpenDay(ymd);
  if (!range) {
    throw new Error(`Invalid Tehran day: ${ymd}`);
  }
  return range;
}

export function getTehranTodayRange(): { start: Date; endExclusive: Date } {
  return getTehranDayRange(getTehranTodayYmd());
}

export function getCurrentJalaliYearMonth(now = new Date()): { jy: number; jm: number } {
  const [jy, jm] = formatJalaliFromUtcInstant(now).split('/').map(Number);
  return { jy, jm };
}

export function getJalaliMonthUtcRange(
  jy: number,
  jm: number,
): { start: Date; end: Date } {
  const ranges = getJalaliMonthRanges(jy);
  const month = ranges[jm - 1];
  if (!month) {
    throw new Error(`Invalid Jalali month: ${jy}/${jm}`);
  }
  return { start: month.start, end: month.end };
}

export function getJalaliYearUtcRange(jy: number): { start: Date; end: Date } {
  const ranges = getJalaliMonthRanges(jy);
  return { start: ranges[0].start, end: ranges[11].end };
}

export function netRialToString(
  sum: bigint | number | null | undefined,
): string {
  if (sum == null) return '0';
  return typeof sum === 'bigint' ? sum.toString() : String(Math.trunc(sum));
}

export function parseServiceSnapshots(raw: unknown): Array<{
  serviceName: string;
  priceAtBooking: number;
}> {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
    const name =
      (typeof row.serviceName === 'string' && row.serviceName.trim()) ||
      (typeof row.name === 'string' && row.name.trim()) ||
      'خدمت';
    const price = Number(row.priceAtBooking ?? 0);
    return {
      serviceName: name,
      priceAtBooking: Number.isFinite(price) ? price : 0,
    };
  });
}
