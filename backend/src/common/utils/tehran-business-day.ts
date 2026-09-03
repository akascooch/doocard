import * as jalaali from 'jalaali-js';

/** Asia/Tehran fixed offset UTC+03:30 (no DST). */
export const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

export function normalizeJalaliDigits(input: string): string {
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  const english = '0123456789';
  return (input || '').replace(/[۰-۹]/g, (d) => english[persian.indexOf(d)] ?? d);
}

export function parseJalaliYmd(
  jalaliStr: string,
): { jy: number; jm: number; jd: number } | null {
  const normalized = normalizeJalaliDigits(jalaliStr).trim().replace(/-/g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  return { jy, jm, jd };
}

/**
 * Authoritative Tehran business-day range used by SERVICE payroll.
 * Returns [startOfDay, endOfDayInclusive] as UTC Instant bounds matching
 * `employee-salary.service` jalaliToUtcRange.
 */
export function jalaliToTehranClosedRange(
  jalaliStr: string,
): { start: Date; endInclusive: Date } | null {
  const j = parseJalaliYmd(jalaliStr);
  if (!j) return null;
  const g = jalaali.toGregorian(j.jy, j.jm, j.jd);
  const start = new Date(
    Date.UTC(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0) - TEHRAN_OFFSET_MS,
  );
  const endInclusive = new Date(
    Date.UTC(g.gy, g.gm - 1, g.gd, 23, 59, 59, 999) - TEHRAN_OFFSET_MS,
  );
  return { start, endInclusive };
}

/**
 * Half-open Tehran day: [start, endExclusive).
 * Prefer this for tip report day filters when calling code uses `gte`/`lt`.
 */
export function jalaliToTehranHalfOpenDay(
  jalaliStr: string,
): { start: Date; endExclusive: Date } | null {
  const closed = jalaliToTehranClosedRange(jalaliStr);
  if (!closed) return null;
  return {
    start: closed.start,
    endExclusive: new Date(closed.start.getTime() + 24 * 60 * 60 * 1000),
  };
}

/**
 * Multi-day range [startOfFirstDay, endInclusiveOfLastDay] (payroll-compatible).
 */
export function jalaliRangeToTehranClosed(
  fromJalali: string,
  toJalali: string,
): { start: Date; endInclusive: Date } | null {
  const from = jalaliToTehranClosedRange(fromJalali);
  const to = jalaliToTehranClosedRange(toJalali);
  if (!from || !to) return null;
  if (from.start.getTime() > to.endInclusive.getTime()) return null;
  return { start: from.start, endInclusive: to.endInclusive };
}

/**
 * Gregorian YYYY-MM-DD interpreted as a Tehran civil calendar day
 * (same convention as appointment slot grid).
 * Returns half-open [start, endExclusive).
 */
export function gregorianYmdToTehranHalfOpenDay(
  dateStr: string,
): { start: Date; endExclusive: Date } | null {
  const parts = (dateStr || '').trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utcMidnightThatDay = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const start = new Date(utcMidnightThatDay - TEHRAN_OFFSET_MS);
  const endExclusive = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, endExclusive };
}

export function formatJalaliFromUtcInstant(d: Date): string {
  const tehranMs = d.getTime() + TEHRAN_OFFSET_MS;
  const t = new Date(tehranMs);
  const gy = t.getUTCFullYear();
  const gm = t.getUTCMonth() + 1;
  const gd = t.getUTCDate();
  const j = jalaali.toJalaali(gy, gm, gd);
  return `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
}

/** Noon Tehran on the given Jalali day — stable effectiveBusinessAt for date-only manual tips. */
export function jalaliDateToTehranNoonUtc(jalaliStr: string): Date | null {
  const half = jalaliToTehranHalfOpenDay(jalaliStr);
  if (!half) return null;
  return new Date(half.start.getTime() + 12 * 60 * 60 * 1000);
}
