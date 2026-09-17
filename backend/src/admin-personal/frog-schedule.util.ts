import * as jalaali from 'jalaali-js';
import { getTehranGregorianYmd } from '../common/utils/tehran-business-day';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const FROG_REMINDER_LEAD_MIN = 120;
export const FROG_REMINDER_WINDOW_MIN = 5;

/** Inclusive window around "2 hours before due": now+115 … now+125 minutes. */
export function frogReminderWindow(now = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getTime() + (FROG_REMINDER_LEAD_MIN - FROG_REMINDER_WINDOW_MIN) * 60_000);
  const to = new Date(now.getTime() + (FROG_REMINDER_LEAD_MIN + FROG_REMINDER_WINDOW_MIN) * 60_000);
  return { from, to };
}

export function isValidDueTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function tehranJalaliDateKey(at = new Date()): string {
  const [gy, gm, gd] = getTehranGregorianYmd(at).split('-').map(Number);
  if (!Number.isInteger(gy) || !Number.isInteger(gm) || !Number.isInteger(gd)) {
    throw new Error('invalid tehran gregorian date');
  }
  const j = jalaali.toJalaali(gy, gm, gd);
  if (!jalaali.isValidJalaaliDate(j.jy, j.jm, j.jd)) {
    throw new Error('invalid jalali conversion');
  }
  return `${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}`;
}

export function isJalaliDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [jy, jm, jd] = value.split('-').map(Number);
  return jy < 1700 && jalaali.isValidJalaaliDate(jy, jm, jd);
}

export function jalaliDateKeyToGregorianYmd(dateKey: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split('-').map(Number);
  if (y >= 1700) {
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (
      probe.getUTCFullYear() !== y ||
      probe.getUTCMonth() + 1 !== m ||
      probe.getUTCDate() !== d
    ) {
      return null;
    }
    return dateKey;
  }
  if (!jalaali.isValidJalaaliDate(y, m, d)) return null;
  const g = jalaali.toGregorian(y, m, d);
  return `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
}

export function gregorianYmdToJalaliDateKey(gregorianYmd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gregorianYmd)) return null;
  const [gy, gm, gd] = gregorianYmd.split('-').map(Number);
  if (gy < 1700) return null;
  try {
    const j = jalaali.toJalaali(gy, gm, gd);
    if (!jalaali.isValidJalaaliDate(j.jy, j.jm, j.jd)) return null;
    return `${j.jy}-${pad2(j.jm)}-${pad2(j.jd)}`;
  } catch {
    return null;
  }
}

/** Interpret Jalali (preferred) or legacy Gregorian YYYY-MM-DD + HH:mm as Asia/Tehran. */
export function tehranScheduledAt(dateKey: string, dueTime: string): Date {
  if (!isValidDueTime(dueTime)) {
    throw new Error('invalid dueTime');
  }
  const gregorian = jalaliDateKeyToGregorianYmd(dateKey);
  if (!gregorian) {
    throw new Error('invalid dateKey');
  }
  return new Date(`${gregorian}T${dueTime}:00+03:30`);
}

export function tehranDueTime(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function buildFrogReminderMessage(title: string, dueTime: string): string {
  const clipped = title.trim().slice(0, 80);
  return `یادآوری قورباغه دوکارد: ${clipped} در ساعت ${dueTime} موعد انجام است.`;
}
