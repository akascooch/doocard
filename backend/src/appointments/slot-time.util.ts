/** Slot start granularity (Asia/Tehran booking grid). */
export const SLOT_INTERVAL_MIN = 30;

export const SLOT_TIME_INSTRUCTION_FA =
  'لطفاً زمان شروع نوبت را از اسلات‌های موجود انتخاب کنید.';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function toEnglishDigits(raw: string): string {
  return String(raw)
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

function tehranHHmmFromDate(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value;
  const minute = parts.find((p) => p.type === 'minute')?.value;
  if (!hour || !minute) return null;
  return `${hour}:${minute}`;
}

/**
 * Canonical booking clock HH:mm on the 30-minute Tehran grid.
 * Drops seconds, accepts Persian digits, and extracts Tehran clock from ISO instants.
 * Does not round 14:10 → 14:00/14:30 (that would hide client bugs and can violate min_2h).
 */
export function normalizeBookingClockTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = toEnglishDigits(String(raw)).trim();
  if (!s) return null;

  if (s.includes('T') || /Z|[+-]\d{2}:\d{2}$/.test(s)) {
    const instant = new Date(s);
    const clock = tehranHHmmFromDate(instant);
    if (!clock) return null;
    s = clock;
  }

  const match = s.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2}(?:\.\d+)?)?$/);
  if (!match) return null;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  if (minutes % SLOT_INTERVAL_MIN !== 0) return null;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
