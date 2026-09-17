import dayjs from 'dayjs';
import jalaliday from 'jalaliday';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import jalaali from 'jalaali-js';

// Extend dayjs with plugins
dayjs.extend(jalaliday);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export type GregorianDateParts = { gy: number; gm: number; gd: number };
export type JalaliDateParts = { jy: number; jm: number; jd: number };

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

const TEHRAN_GREGORIAN_YMD = new Intl.DateTimeFormat('en-CA-u-ca-gregory-nu-latn', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function isFiniteInt(n: number): boolean {
  return typeof n === 'number' && Number.isInteger(n) && Number.isFinite(n);
}

export function isValidGregorianYmd(gy: number, gm: number, gd: number): boolean {
  if (!isFiniteInt(gy) || !isFiniteInt(gm) || !isFiniteInt(gd)) return false;
  if (gy < 1600 || gy > 2500 || gm < 1 || gm > 12 || gd < 1 || gd > 31) return false;
  const probe = new Date(Date.UTC(gy, gm - 1, gd));
  return (
    probe.getUTCFullYear() === gy &&
    probe.getUTCMonth() + 1 === gm &&
    probe.getUTCDate() === gd
  );
}

export function formatGregorianYmd(parts: GregorianDateParts): string {
  return `${parts.gy}-${pad2(parts.gm)}-${pad2(parts.gd)}`;
}

export function formatJalaliParts(parts: JalaliDateParts, separator: '/' | '-' = '/'): string {
  return `${parts.jy}${separator}${pad2(parts.jm)}${separator}${pad2(parts.jd)}`;
}

/** Offset fallback when Intl calendar/numbering is unavailable. Tehran has no DST. */
function tehranGregorianPartsFromOffset(date: Date): GregorianDateParts | null {
  const shifted = new Date(date.getTime() + TEHRAN_OFFSET_MS);
  const gy = shifted.getUTCFullYear();
  const gm = shifted.getUTCMonth() + 1;
  const gd = shifted.getUTCDate();
  if (!isValidGregorianYmd(gy, gm, gd)) return null;
  return { gy, gm, gd };
}

export function getTehranGregorianDateParts(date?: Date): GregorianDateParts | null {
  const source = date ?? new Date();
  if (!(source instanceof Date) || Number.isNaN(source.getTime())) return null;
  try {
    const parts = TEHRAN_GREGORIAN_YMD.formatToParts(source);
    const gy = Number(parts.find((part) => part.type === 'year')?.value);
    const gm = Number(parts.find((part) => part.type === 'month')?.value);
    const gd = Number(parts.find((part) => part.type === 'day')?.value);
    if (isValidGregorianYmd(gy, gm, gd)) return { gy, gm, gd };
  } catch {
    // fall through to offset arithmetic
  }
  return tehranGregorianPartsFromOffset(source);
}

export function safeToJalaali(gy: number, gm: number, gd: number): JalaliDateParts | null {
  if (!isValidGregorianYmd(gy, gm, gd)) return null;
  try {
    const converted = jalaali.toJalaali(gy, gm, gd);
    if (!converted || !isFiniteInt(converted.jy) || !isFiniteInt(converted.jm) || !isFiniteInt(converted.jd)) {
      return null;
    }
    if (typeof jalaali.isValidJalaaliDate === 'function') {
      if (!jalaali.isValidJalaaliDate(converted.jy, converted.jm, converted.jd)) return null;
    } else if (converted.jy < 1200 || converted.jy > 1700 || converted.jm < 1 || converted.jm > 12) {
      return null;
    }
    return converted;
  } catch {
    return null;
  }
}

export function safeToGregorian(jy: number, jm: number, jd: number): GregorianDateParts | null {
  if (!isFiniteInt(jy) || !isFiniteInt(jm) || !isFiniteInt(jd)) return null;
  if (typeof jalaali.isValidJalaaliDate === 'function' && !jalaali.isValidJalaaliDate(jy, jm, jd)) {
    return null;
  }
  try {
    const converted = jalaali.toGregorian(jy, jm, jd);
    if (!converted || !isValidGregorianYmd(converted.gy, converted.gm, converted.gd)) return null;
    return converted;
  } catch {
    return null;
  }
}

function parseJalaliYmdParts(jalaliDate: string): JalaliDateParts | null {
  if (!jalaliDate) return null;
  const normalized = persianToEnglishDigits(jalaliDate).replace(/\//g, '-');
  const [jy, jm, jd] = normalized.split('-').map(Number);
  if (!safeToGregorian(jy, jm, jd)) return null;
  return { jy, jm, jd };
}

/**
 * Format a Gregorian date to Jalali (Persian) date string
 * Uses jalaali-js for accurate conversion (dayjs jalaliday has bugs with dates)
 * @param date - Date object, ISO string, or timestamp
 * @param format - Output format (default: 'YYYY/MM/DD')
 * @returns Jalali date string
 * @example
 * formatToJalali('2021-03-21') // Returns '1400/01/01'
 * formatToJalali(new Date(), 'YYYY/MM/DD HH:mm') // Returns '1400/01/01 12:30'
 */
export const formatToJalali = (
  date: string | Date | number,
  format: string = 'YYYY/MM/DD'
): string => {
  if (!date) return '';
  
  try {
    // Parse to Date object
    let dateObj: Date;
    if (typeof date === 'string' && date.includes('T')) {
      // ISO string
      dateObj = new Date(date);
    } else if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Date-only string (YYYY-MM-DD) - treat as local date, not UTC
      const [year, month, day] = date.split('-').map(Number);
      dateObj = new Date(year, month - 1, day);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      dateObj = new Date(date);
    }
    
    const jalaliParts = safeToJalaali(
      dateObj.getFullYear(),
      dateObj.getMonth() + 1,
      dateObj.getDate(),
    );
    if (!jalaliParts) return '';
    const { jy, jm, jd } = jalaliParts;
    
    // Format simple date formats directly
    if (format === 'YYYY/MM/DD') {
      return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;
    } else if (format === 'YYYY-MM-DD') {
      return `${jy}-${jm.toString().padStart(2, '0')}-${jd.toString().padStart(2, '0')}`;
    } else if (format === 'YYYY/MM/DD HH:mm') {
      const hours = dateObj.getHours().toString().padStart(2, '0');
      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
      return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')} ${hours}:${minutes}`;
    } else {
      // For complex formats, use dayjs (may have slight inaccuracies)
      const parsed = dayjs(dateObj);
      return parsed.calendar('jalali').locale('fa').format(format);
    }
  } catch {
    return '';
  }
};

export function isValidJalaliValue(value: unknown): boolean {
  return typeof value === 'string' && parseJalaliYmdParts(value) !== null;
}

export function formatTehranJalaliValue(value: unknown, format: string = 'YYYY/MM/DD'): string {
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
    return formatToJalali(value, format);
  }
  return '';
}

/**
 * Parse a Jalali date string to Gregorian Date object
 * @param jalaliDate - Jalali date string (e.g., '1400/01/01')
 * @param format - Input format (default: 'YYYY/MM/DD')
 * @returns JavaScript Date object (midnight local time)
 * @example
 * parseFromJalali('1400/01/01') // Returns Date object for 2021-03-21 00:00:00 local time
 */
export const parseFromJalali = (
  jalaliDate: string,
  format: string = 'YYYY/MM/DD'
): Date | null => {
  if (!jalaliDate) return null;
  
  try {
    // Normalize: convert Persian digits and / to -
    const normalized = persianToEnglishDigits(jalaliDate).replace(/\//g, '-');
    const [jy, jm, jd] = normalized.split('-').map(Number);
    
    const gregorian = safeToGregorian(jy, jm, jd);
    if (!gregorian) return null;
    const { gy, gm, gd } = gregorian;
    return new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0, 0));
  } catch (error) {
    console.error('Error parsing Jalali date:', error);
    return null;
  }
};

/**
 * Convert Jalali date string to ISO string for API calls
 * @param jalaliDate - Jalali date string
 * @returns ISO 8601 string at noon UTC (to avoid timezone issues)
 */
export const jalaliToISO = (jalaliDate: string): string | null => {
  const date = parseFromJalali(jalaliDate);
  if (!date) return null;
  
  // Format as YYYY-MM-DD at noon UTC to avoid timezone shifting
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T12:00:00.000Z`;
};

/**
 * Convert Jalali date to Gregorian date string (YYYY-MM-DD)
 * Uses jalaali-js for accurate conversion
 * @param jalaliDate - Jalali date string (YYYY/MM/DD or YYYY-MM-DD)
 * @returns Gregorian date string (YYYY-MM-DD)
 * @example
 * jalaliToGregorian('1404/08/06') // Returns '2025-10-28'
 * jalaliToGregorian('1404-08-06') // Returns '2025-10-28'
 */
export const jalaliToGregorian = (jalaliDate: string): string | null => {
  if (!jalaliDate) return null;
  
  try {
    // Normalize: convert / to - and remove any Persian digits
    const normalized = persianToEnglishDigits(jalaliDate).replace(/\//g, '-');
    const [jy, jm, jd] = normalized.split('-').map(Number);
    
    const gregorian = safeToGregorian(jy, jm, jd);
    if (!gregorian) return null;
    return formatGregorianYmd(gregorian);
  } catch (error) {
    console.error('Error converting Jalali to Gregorian:', error);
    return null;
  }
};

/**
 * Get current date in Jalali format (timezone-safe)
 * Uses jalaali-js directly for accurate conversion (not dayjs jalaliday which has bugs)
 * @param format - Output format (default: 'YYYY/MM/DD')
 * @returns Current Jalali date string
 */
export const getCurrentJalaliDate = (format: string = 'YYYY/MM/DD'): string => {
  const parts = getTehranGregorianDateParts();
  const jalaliParts = parts ? safeToJalaali(parts.gy, parts.gm, parts.gd) : null;
  if (!jalaliParts) return '';
  const { jy, jm, jd } = jalaliParts;
  if (format === 'YYYY/MM/DD') return formatJalaliParts(jalaliParts, '/');
  if (format === 'YYYY-MM-DD') return formatJalaliParts(jalaliParts, '-');
  try {
    const localDate = new Date(parts!.gy, parts!.gm - 1, parts!.gd);
    return dayjs(localDate).calendar('jalali').locale('fa').format(format);
  } catch {
    return `${jy}/${pad2(jm)}/${pad2(jd)}`;
  }
};

/**
 * Format Jalali date with time
 * @param date - Date to format
 * @returns Formatted Jalali date and time string
 */
export const formatJalaliDateTime = (date: string | Date): string => {
  return formatToJalali(date, 'YYYY/MM/DD HH:mm');
};

/**
 * Format Jalali date in long format (with month name)
 * @param date - Date to format
 * @returns Formatted Jalali date with month name
 */
export const formatJalaliLong = (date: string | Date): string => {
  return formatToJalali(date, 'DD MMMM YYYY');
};

/**
 * Convert Persian (Farsi) digits to English digits
 * @param str - String with Persian digits
 * @returns String with English digits
 */
export const persianToEnglishDigits = (str: string): string => {
  if (!str) return '';
  
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  
  return str
    .split('')
    .map((char) => {
      const persianIndex = persianDigits.indexOf(char);
      if (persianIndex !== -1) return persianIndex.toString();
      
      const arabicIndex = arabicDigits.indexOf(char);
      if (arabicIndex !== -1) return arabicIndex.toString();
      
      return char;
    })
    .join('');
};

/**
 * Convert English digits to Persian (Farsi) digits
 * @param str - String with English digits
 * @returns String with Persian digits
 */
export const englishToPersianDigits = (str: string): string => {
  if (!str) return '';
  
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
};

/**
 * Validate if a string is a valid Jalali date
 * @param jalaliDate - Date string to validate
 * @returns true if valid
 */
export const isValidJalaliDate = (jalaliDate: string): boolean => {
  return parseJalaliYmdParts(jalaliDate) != null;
};

/**
 * Get relative time in Persian (e.g., "۲ روز پیش")
 * @param date - Date to compare
 * @returns Relative time string in Persian
 */
export const getRelativeTime = (date: string | Date): string => {
  if (!date) return '';
  
  try {
    const now = dayjs();
    const target = dayjs(date);
    const diffDays = now.diff(target, 'day');
    
    if (diffDays === 0) return 'امروز';
    if (diffDays === 1) return 'دیروز';
    if (diffDays === -1) return 'فردا';
    if (diffDays > 1 && diffDays < 7) return `${englishToPersianDigits(diffDays.toString())} روز پیش`;
    if (diffDays < 0 && diffDays > -7) return `${englishToPersianDigits(Math.abs(diffDays).toString())} روز دیگر`;
    
    return formatToJalali(date);
  } catch {
    return '';
  }
};

/**
 * Format time only (HH:mm)
 * @param date - Date to format
 * @returns Time string
 */
export const formatTime = (date: string | Date): string => {
  if (!date) return '';
  
  try {
    return dayjs(date).format('HH:mm');
  } catch {
    return '';
  }
};

/**
 * Parse time string to Date object (today's date with specified time)
 * @param timeString - Time in format 'HH:mm'
 * @returns Date object with today's date and specified time
 */
export const parseTime = (timeString: string): Date | null => {
  if (!timeString) return null;
  
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  } catch {
    return null;
  }
};

/** Persian weekday names (Sunday = 0 .. Saturday = 6, same as JS getDay()) */
const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه\u200cشنبه', 'چهارشنبه', 'پنج\u200cشنبه', 'جمعه', 'شنبه'];

/**
 * Get Persian weekday name for a Jalali date string
 * @param jalaliDate - Jalali date string (YYYY/MM/DD or YYYY-MM-DD)
 * @returns Weekday name in Persian (e.g. سه‌شنبه) or empty string
 */
export const getJalaliWeekdayName = (jalaliDate: string): string => {
  const date = parseFromJalali(jalaliDate);
  if (!date) return '';
  const dayIndex = date.getUTCDay();
  return PERSIAN_WEEKDAYS[dayIndex] ?? '';
};

/**
 * Add days to a Jalali date string
 * @param jalaliDate - Jalali date string (YYYY/MM/DD)
 * @param days - Number of days to add (negative for subtract)
 * @returns New Jalali date string in YYYY/MM/DD
 */
export const addDaysToJalali = (jalaliDate: string, days: number): string => {
  const date = parseFromJalali(jalaliDate);
  if (!date) return jalaliDate;
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return formatToJalali(result, 'YYYY/MM/DD');
};

/**
 * Compare two Jalali date strings (date part only)
 * @returns true if a <= b
 */
export const isJalaliDateBeforeOrEqual = (a: string, b: string): boolean => {
  const norm = (s: string) => persianToEnglishDigits(s).replace(/\//g, '-').split('-').map(Number);
  const [ay, am, ad] = norm(a);
  const [by, bm, bd] = norm(b);
  if (ay !== by) return ay < by;
  if (am !== bm) return am < bm;
  return ad <= bd;
};

/**
 * Compare two Jalali date strings (date part only, strict)
 * @returns true if a < b
 */
export const isJalaliDateBefore = (a: string, b: string): boolean => {
  const norm = (s: string) => persianToEnglishDigits(s).replace(/\//g, '-').split('-').map(Number);
  const [ay, am, ad] = norm(a);
  const [by, bm, bd] = norm(b);
  if (ay !== by) return ay < by;
  if (am !== bm) return am < bm;
  return ad < bd;
};

/** Gregorian YYYY-MM-DD for "today" in Asia/Tehran */
export const getTehranTodayGregorian = (): string => {
  const parts = getTehranGregorianDateParts();
  return parts ? formatGregorianYmd(parts) : '';
};

/**
 * Jalali "today" for Asia/Tehran (not browser-local timezone).
 * Prefer this over getCurrentJalaliDate() for filter defaults.
 */
export const getTehranTodayJalali = (format: string = 'YYYY/MM/DD'): string => {
  const parts = getTehranGregorianDateParts();
  const jalaliParts = parts ? safeToJalaali(parts.gy, parts.gm, parts.gd) : null;
  if (!jalaliParts) return '';
  if (format === 'YYYY-MM-DD') return formatJalaliParts(jalaliParts, '-');
  return formatJalaliParts(jalaliParts, '/');
};

/** Jalali first-of-month → today (Asia/Tehran). For salary withdrawal filters. */
export const getTehranCurrentJalaliMonthRange = (): { from: string; to: string } => {
  const today = getTehranTodayJalali('YYYY/MM/DD');
  const parsed = parseJalaliYmdParts(today);
  if (!parsed) return { from: '', to: '' };
  return { from: `${parsed.jy}/${pad2(parsed.jm)}/01`, to: today };
};

/** Add calendar days to a Gregorian YYYY-MM-DD in Asia/Tehran. */
export const addDaysGregorianTehran = (
  gregorianDate: string,
  days: number,
): string => {
  const d = new Date(`${gregorianDate}T12:00:00+03:30`);
  if (Number.isNaN(d.getTime())) return '';
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  const parts = getTehranGregorianDateParts(d);
  return parts ? formatGregorianYmd(parts) : '';
};

/**
 * Weekday in Asia/Tehran for a Gregorian date.
 * Returns JS-style index: 0=Sunday … 6=Saturday.
 */
export const getTehranWeekdayIndex = (gregorianDate: string): number => {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'short',
  }).format(new Date(`${gregorianDate}T12:00:00+03:30`));
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[weekday] ?? 0;
};

/** ISO datetime with explicit +03:30 offset */
export const tehranIsoFromGregorianDate = (
  gregorianDate: string,
  time: string = '00:00:00',
): string => `${gregorianDate}T${time}+03:30`;

/** Full-day bounds for a Jalali date in Tehran timezone */
export const jalaliDayBoundsTehran = (
  jalaliDate: string,
): { from: string; to: string } | null => {
  const g = jalaliToGregorian(jalaliDate);
  if (!g) return null;
  return {
    from: tehranIsoFromGregorianDate(g, '00:00:00'),
    to: tehranIsoFromGregorianDate(g, '23:59:59'),
  };
};

/** HH:mm in Asia/Tehran from an ISO timestamp, or pass-through of HH:mm. */
export const tehranHHmmFromIso = (value: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
    const [h, m] = trimmed.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value;
  const minute = parts.find((part) => part.type === 'minute')?.value;
  if (!hour || !minute) return null;
  return `${hour}:${minute}`;
};

/**
 * Snap a typed HH:mm clock to the 30-minute grid.
 * Ties round later (safer for the 2h lead-time rule). 23:45 stays 23:30.
 */
export const snapToThirtyMinuteClock = (hhmm: string): string | null => {
  const match = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  const down = Math.floor(minutes / 30) * 30;
  const up = down + 30;
  const useLater = up - minutes <= minutes - down;
  let snappedHours = hours;
  let snappedMinutes = useLater ? up : down;
  if (snappedMinutes === 60) {
    snappedHours += 1;
    snappedMinutes = 0;
  }
  if (snappedHours > 23) {
    snappedHours = 23;
    snappedMinutes = 30;
  }
  return `${String(snappedHours).padStart(2, '0')}:${String(snappedMinutes).padStart(2, '0')}`;
};

/** Jalali YYYY/MM/DD + Tehran HH:mm for appointment display (not browser-local). */
export const formatAppointmentWhenTehran = (iso: string | Date): string => {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (!date || Number.isNaN(date.getTime())) return '';
  const parts = getTehranGregorianDateParts(date);
  const jalaliParts = parts ? safeToJalaali(parts.gy, parts.gm, parts.gd) : null;
  if (!jalaliParts) return '';
  const time = tehranHHmmFromIso(date.toISOString()) || '';
  return `${formatJalaliParts(jalaliParts, '/')}${time ? ` ${time}` : ''}`;
};

/** Jalali picker value → API jalaliDate YYYY-MM-DD */
export const jalaliToApiDate = (jalaliDate: string): string | null => {
  if (!jalaliDate) return null;
  const normalized = persianToEnglishDigits(jalaliDate).replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
};

/**
 * Convert a picker date to the Gregorian YYYY-MM-DD the slots API expects.
 * Years >= 1700 are treated as already-Gregorian so ISO dates are not re-parsed as Jalali.
 */
export const slotsApiDateFromPicker = (date: string): string | null => {
  if (!date) return null;
  const normalized = persianToEnglishDigits(date).replace(/\//g, '-');
  const year = Number(normalized.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  if (year >= 1700) {
    return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
  }
  return jalaliToGregorian(date);
};

/** Jalali date + HH:mm → ISO with +03:30 */
export const jalaliDateTimeTehranIso = (
  jalaliDate: string,
  time: string,
): string | null => {
  const g = jalaliToGregorian(jalaliDate);
  if (!g || !time) return null;
  const [h, m] = time.split(':');
  const hh = (h ?? '00').padStart(2, '0');
  const mm = (m ?? '00').padStart(2, '0');
  return tehranIsoFromGregorianDate(g, `${hh}:${mm}:00`);
};

/**
 * Jalali from/to range in Tehran.
 * Optional HH:mm times; when omitted, uses full-day bounds (00:00:00 / 23:59:59).
 */
export const jalaliDateRangeBoundsTehran = (
  fromJalali: string,
  toJalali: string,
  fromTime?: string | null,
  toTime?: string | null,
): { from: string; to: string } | null => {
  const from = fromTime?.trim()
    ? jalaliDateTimeTehranIso(fromJalali, fromTime.trim())
    : jalaliDayBoundsTehran(fromJalali)?.from ?? null;
  const to = toTime?.trim()
    ? jalaliDateTimeTehranIso(toJalali, toTime.trim())
    : jalaliDayBoundsTehran(toJalali)?.to ?? null;
  if (!from || !to) return null;
  return { from, to };
};

/**
 * Current Persian business week in Tehran: Saturday 00:00 → Friday 23:59:59.
 */
export const getTehranJalaliWeekBounds = (
  referenceGregorian?: string,
): { from: string; to: string } => {
  const todayG = referenceGregorian || getTehranTodayGregorian();
  const weekday = getTehranWeekdayIndex(todayG);
  // Saturday start: Sat=0 days back, Sun=1, … Fri=6
  const daysSinceSaturday = (weekday + 1) % 7;
  const weekStartG = addDaysGregorianTehran(todayG, -daysSinceSaturday);
  const weekEndG = addDaysGregorianTehran(weekStartG, 6);
  return {
    from: tehranIsoFromGregorianDate(weekStartG, '00:00:00'),
    to: tehranIsoFromGregorianDate(weekEndG, '23:59:59'),
  };
};

/**
 * Current Jalali month in Tehran: 1st of month 00:00:00 → today 23:59:59.
 */
export const getTehranJalaliMonthToTodayBounds = (
  referenceGregorian?: string,
): { from: string; to: string } => {
  const todayG = referenceGregorian || getTehranTodayGregorian();
  const [gy, gm, gd] = todayG.split('-').map(Number);
  const jalaliParts = safeToJalaali(gy, gm, gd);
  if (!jalaliParts || !todayG) return { from: '', to: '' };
  const monthStart = safeToGregorian(jalaliParts.jy, jalaliParts.jm, 1);
  if (!monthStart) return { from: '', to: '' };
  return {
    from: tehranIsoFromGregorianDate(formatGregorianYmd(monthStart), '00:00:00'),
    to: tehranIsoFromGregorianDate(todayG, '23:59:59'),
  };
};

export type TehranAppointmentPreset =
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'week'
  | 'month'
  | 'all';

/** Shared preset ranges for appointment list filters (Tehran-safe). */
export const getTehranAppointmentPresetRange = (
  filter: TehranAppointmentPreset,
): { from?: string; to?: string } => {
  const todayStr = getTehranTodayGregorian();
  if (!todayStr) return {};
  const tomorrowStr = addDaysGregorianTehran(todayStr, 1);

  switch (filter) {
    case 'today':
      return {
        from: tehranIsoFromGregorianDate(todayStr, '00:00:00'),
        to: tehranIsoFromGregorianDate(todayStr, '23:59:59'),
      };
    case 'yesterday': {
      const yesterdayStr = addDaysGregorianTehran(todayStr, -1);
      return {
        from: tehranIsoFromGregorianDate(yesterdayStr, '00:00:00'),
        to: tehranIsoFromGregorianDate(yesterdayStr, '23:59:59'),
      };
    }
    case 'tomorrow':
      return {
        from: tehranIsoFromGregorianDate(tomorrowStr, '00:00:00'),
        to: tehranIsoFromGregorianDate(tomorrowStr, '23:59:59'),
      };
    case 'week':
      return getTehranJalaliWeekBounds(todayStr);
    case 'month':
      return getTehranJalaliMonthToTodayBounds(todayStr);
    case 'all':
    default:
      return {};
  }
};

// Export dayjs configured with Jalali for advanced use cases
export const jalaliDayjs = dayjs;

const dateHelpers = {
  formatToJalali,
  parseFromJalali,
  jalaliToISO,
  jalaliToGregorian,
  getCurrentJalaliDate,
  formatJalaliDateTime,
  formatJalaliLong,
  persianToEnglishDigits,
  englishToPersianDigits,
  isValidJalaliDate,
  getRelativeTime,
  formatTime,
  parseTime,
  getJalaliWeekdayName,
  addDaysToJalali,
  isJalaliDateBeforeOrEqual,
  isJalaliDateBefore,
  getTehranTodayGregorian,
  getTehranTodayJalali,
  getTehranCurrentJalaliMonthRange,
  addDaysGregorianTehran,
  getTehranWeekdayIndex,
  tehranIsoFromGregorianDate,
  jalaliDayBoundsTehran,
  jalaliDateRangeBoundsTehran,
  getTehranJalaliWeekBounds,
  getTehranJalaliMonthToTodayBounds,
  getTehranAppointmentPresetRange,
  jalaliDateTimeTehranIso,
  tehranHHmmFromIso,
  snapToThirtyMinuteClock,
  formatAppointmentWhenTehran,
  jalaliToApiDate,
  slotsApiDateFromPicker,
  getTehranGregorianDateParts,
  safeToJalaali,
  safeToGregorian,
  isValidJalaliValue,
  formatTehranJalaliValue,
};

export default dateHelpers;

