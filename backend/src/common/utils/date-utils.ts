import * as jalaali from 'jalaali-js';

/**
 * Convert Jalali (Shamsi/Persian) date string to Gregorian Date object
 * @param jalaliDate - String in format 'YYYY/MM/DD' (e.g., '1377/11/22')
 * @returns JavaScript Date object in Gregorian calendar
 * @example
 * toGregorian('1400/01/01') // Returns Date object for 2021-03-21
 */
export function toGregorian(jalaliDate: string): Date {
  if (!jalaliDate) {
    return null;
  }

  try {
    // Handle both '/' and '-' separators
    const parts = jalaliDate.split(/[\/\-]/).map(Number);
    
    if (parts.length !== 3) {
      throw new Error('Invalid date format. Expected YYYY/MM/DD');
    }

    const [jy, jm, jd] = parts;
    
    // Validate Jalali date
    if (!jalaali.isValidJalaaliDate(jy, jm, jd)) {
      throw new Error('Invalid Jalali date');
    }

    const g = jalaali.toGregorian(jy, jm, jd);
    return new Date(g.gy, g.gm - 1, g.gd);
  } catch (error) {
    console.error('Error converting Jalali to Gregorian:', error.message);
    return null;
  }
}

/**
 * Convert Gregorian Date object to Jalali (Shamsi/Persian) date string
 * @param date - JavaScript Date object or ISO string
 * @returns String in format 'YYYY/MM/DD' (e.g., '1377/11/22')
 * @example
 * toJalaliString(new Date('2021-03-21')) // Returns '1400/01/01'
 */
export function toJalaliString(date: Date | string): string {
  if (!date) {
    return '';
  }

  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) {
      throw new Error('Invalid date');
    }

    const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
  } catch (error) {
    console.error('Error converting Gregorian to Jalali:', error.message);
    return '';
  }
}

/**
 * Convert Jalali date string to ISO 8601 string for API/database
 * @param jalaliDate - String in format 'YYYY/MM/DD'
 * @returns ISO 8601 string (e.g., '2021-03-21T00:00:00.000Z')
 */
export function toISOString(jalaliDate: string): string {
  const date = toGregorian(jalaliDate);
  return date ? date.toISOString() : null;
}

/**
 * Get current date in Jalali format
 * @returns Current date as Jalali string 'YYYY/MM/DD'
 */
export function getCurrentJalaliDate(): string {
  return toJalaliString(new Date());
}

/**
 * Format Jalali date for display with Persian digits
 * @param jalaliDate - String in format 'YYYY/MM/DD'
 * @returns Formatted string with Persian numerals
 */
export function formatJalaliWithPersianDigits(jalaliDate: string): string {
  if (!jalaliDate) return '';
  
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return jalaliDate.replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
}

/**
 * Validate if a string is a valid Jalali date
 * @param jalaliDate - String to validate
 * @returns true if valid Jalali date
 */
export function isValidJalaliDate(jalaliDate: string): boolean {
  if (!jalaliDate) return false;
  
  try {
    const parts = jalaliDate.split(/[\/\-]/).map(Number);
    if (parts.length !== 3) return false;
    
    const [jy, jm, jd] = parts;
    return jalaali.isValidJalaaliDate(jy, jm, jd);
  } catch {
    return false;
  }
}

/** Asia/Tehran offset: UTC+3:30 in milliseconds */
const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

/** Jalali month names 1..12 (Farvardin → Esfand) */
export const JALALI_MONTH_NAMES: Record<number, string> = {
  1: 'فروردین',
  2: 'اردیبهشت',
  3: 'خرداد',
  4: 'تیر',
  5: 'مرداد',
  6: 'شهریور',
  7: 'مهر',
  8: 'آبان',
  9: 'آذر',
  10: 'دی',
  11: 'بهمن',
  12: 'اسفند',
};

export interface JalaliMonthRange {
  month: number;
  monthName: string;
  start: Date;
  end: Date;
}

/**
 * Get start and end Date (UTC, Asia/Tehran boundaries) for each Jalali month in a year.
 * Used for yearly report aggregation (Farvardin → Esfand).
 */
export function getJalaliMonthRanges(jy: number): JalaliMonthRange[] {
  const ranges: JalaliMonthRange[] = [];
  for (let jm = 1; jm <= 12; jm++) {
    const gFirst = jalaali.toGregorian(jy, jm, 1);
    const startUtc =
      Date.UTC(gFirst.gy, gFirst.gm - 1, gFirst.gd, 0, 0, 0, 0) - TEHRAN_OFFSET_MS;
    const start = new Date(startUtc);

    const nextMonth = jm === 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: jm + 1 };
    const gNextFirst = jalaali.toGregorian(nextMonth.jy, nextMonth.jm, 1);
    const endUtc =
      Date.UTC(gNextFirst.gy, gNextFirst.gm - 1, gNextFirst.gd, 0, 0, 0, 0) -
      TEHRAN_OFFSET_MS -
      1;
    const end = new Date(endUtc);

    ranges.push({
      month: jm,
      monthName: JALALI_MONTH_NAMES[jm],
      start,
      end,
    });
  }
  return ranges;
}

