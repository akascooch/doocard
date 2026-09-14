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

/** Interpret YYYY-MM-DD + HH:mm as Asia/Tehran (no DST). */
export function tehranScheduledAt(dateKey: string, dueTime: string): Date {
  if (!isValidDueTime(dueTime)) {
    throw new Error('invalid dueTime');
  }
  return new Date(`${dateKey}T${dueTime}:00+03:30`);
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
