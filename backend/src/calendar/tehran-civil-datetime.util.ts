/**
 * Asia/Tehran is UTC+03:30 with no DST. Pair UTC-midnight Gregorian civil days
 * with wall-clock HH:mm without using the host timezone.
 */
export function utcMidnightToYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeHHmm(time: string): string | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(time || '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function tehranIsoFromUtcMidnightAndTime(
  utcMidnight: Date,
  timeHHmm: string,
): string {
  const ymd = utcMidnightToYmd(utcMidnight);
  const hhmm = normalizeHHmm(timeHHmm);
  if (!hhmm) {
    throw new Error('Invalid time');
  }
  return `${ymd}T${hhmm}:00+03:30`;
}
