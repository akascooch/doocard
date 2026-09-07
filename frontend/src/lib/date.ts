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
    
    // Convert to Jalali using jalaali-js (accurate)
    const { jy, jm, jd } = jalaali.toJalaali(
      dateObj.getFullYear(),
      dateObj.getMonth() + 1,
      dateObj.getDate()
    );
    
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
  } catch (error) {
    console.error('Error formatting to Jalali:', error);
    return '';
  }
};

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
    
    // Validate
    if (!jy || !jm || !jd) {
      console.error('Invalid Jalali date format:', jalaliDate);
      return null;
    }
    
    // Convert using jalaali-js (more accurate than dayjs)
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    
    // Create UTC date at midnight
    const date = new Date(Date.UTC(gy, gm - 1, gd, 0, 0, 0, 0));
    
    console.log(`🔄 parseFromJalali: ${jalaliDate} → ${jy}-${jm}-${jd} (J) → ${gy}-${gm}-${gd} (G) → ${date.toISOString().split('T')[0]}`);
    
    return date;
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
    
    // Validate
    if (!jy || !jm || !jd) return null;
    
    // Convert using jalaali-js
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    
    return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
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
  // Use jalaali-js for accurate conversion (same as backend)
  const now = new Date();
  const { jy, jm, jd } = jalaali.toJalaali(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate()
  );
  
  // Format according to requested format
  if (format === 'YYYY/MM/DD') {
    return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;
  } else if (format === 'YYYY-MM-DD') {
    return `${jy}-${jm.toString().padStart(2, '0')}-${jd.toString().padStart(2, '0')}`;
  } else {
    // Fallback to dayjs for complex formats
    const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return dayjs(localDate).calendar('jalali').locale('fa').format(format);
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
  if (!jalaliDate) return false;
  
  try {
    // Normalize digits first
    const normalized = persianToEnglishDigits(jalaliDate);
    const parsed = dayjs(normalized, { format: 'YYYY/MM/DD', jalali: true });
    return parsed.isValid();
  } catch {
    return false;
  }
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
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
};

/**
 * Jalali "today" for Asia/Tehran (not browser-local timezone).
 * Prefer this over getCurrentJalaliDate() for filter defaults.
 */
export const getTehranTodayJalali = (format: string = 'YYYY/MM/DD'): string => {
  const todayG = getTehranTodayGregorian();
  const [gy, gm, gd] = todayG.split('-').map(Number);
  const { jy, jm, jd } = jalaali.toJalaali(gy, gm, gd);
  const y = String(jy);
  const m = String(jm).padStart(2, '0');
  const d = String(jd).padStart(2, '0');
  if (format === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
  return `${y}/${m}/${d}`;
};

/** Jalali first-of-month → today (Asia/Tehran). For salary withdrawal filters. */
export const getTehranCurrentJalaliMonthRange = (): { from: string; to: string } => {
  const today = getTehranTodayJalali('YYYY/MM/DD');
  const [jy, jm] = today.split('/');
  return { from: `${jy}/${jm}/01`, to: today };
};

/** Add calendar days to a Gregorian YYYY-MM-DD in Asia/Tehran. */
export const addDaysGregorianTehran = (
  gregorianDate: string,
  days: number,
): string => {
  const d = new Date(`${gregorianDate}T12:00:00+03:30`);
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
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
  const { jy, jm } = jalaali.toJalaali(gy, gm, gd);
  const { gy: startGy, gm: startGm, gd: startGd } = jalaali.toGregorian(jy, jm, 1);
  const monthStartG = `${startGy}-${String(startGm).padStart(2, '0')}-${String(startGd).padStart(2, '0')}`;
  return {
    from: tehranIsoFromGregorianDate(monthStartG, '00:00:00'),
    to: tehranIsoFromGregorianDate(todayG, '23:59:59'),
  };
};

export type TehranAppointmentPreset =
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'month'
  | 'all';

/** Shared preset ranges for appointment list filters (Tehran-safe). */
export const getTehranAppointmentPresetRange = (
  filter: TehranAppointmentPreset,
): { from?: string; to?: string } => {
  const todayStr = getTehranTodayGregorian();
  const tomorrowStr = addDaysGregorianTehran(todayStr, 1);

  switch (filter) {
    case 'today':
      return {
        from: tehranIsoFromGregorianDate(todayStr, '00:00:00'),
        to: tehranIsoFromGregorianDate(todayStr, '23:59:59'),
      };
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

export default {
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
};

