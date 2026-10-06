/**
 * Appointment status and debt washes.
 * Light text is one step darker than Tailwind 600: emerald-600, amber-600,
 * and rose-600 fall below AA on a 15% color wash over a white card.
 * Dark text uses the 300 step so it stays AA on the dark card wash.
 */
export const APPOINTMENT_STATUS_WASH = {
  success:
    'border-emerald-700/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300',
  warning:
    'border-amber-700/40 bg-amber-500/15 text-amber-900 dark:text-amber-300',
  danger:
    'border-rose-700/40 bg-rose-500/15 text-rose-800 dark:text-rose-300',
} as const;

const NEUTRAL_BADGE = 'border-border bg-card text-foreground';

export function appointmentStatusBadgeClass(status: string): string {
  switch (status) {
    case 'SETTLED':
    case 'PAID':
      return APPOINTMENT_STATUS_WASH.success;
    case 'PENDING':
    case 'PENDING_CONFIRMATION':
    case 'CONFIRMED':
    case 'IN_PROGRESS':
    case 'COMPLETED':
      return APPOINTMENT_STATUS_WASH.warning;
    case 'CANCELLED':
      return APPOINTMENT_STATUS_WASH.danger;
    default:
      return NEUTRAL_BADGE;
  }
}

export function appointmentPaymentBadgeClass(
  method: string | null | undefined,
): string {
  if (method === 'DEBT') return APPOINTMENT_STATUS_WASH.danger;
  return NEUTRAL_BADGE;
}
