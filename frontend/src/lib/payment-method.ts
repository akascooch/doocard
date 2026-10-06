/** Labels already used by the settlement form. CARD is «کارت خوان». */
export const APPOINTMENT_PAYMENT_METHOD_LABELS = {
  CASH: 'نقدی',
  CARD: 'کارت خوان',
  ONLINE: 'آنلاین',
  TRANSFER: 'انتقال',
  CHEQUE: 'چک',
  CARD2CARD: 'کارت به کارت',
  DEBT: 'بدهی',
} as const;

export type AppointmentPaymentMethod = keyof typeof APPOINTMENT_PAYMENT_METHOD_LABELS;

export const APPOINTMENT_PAYMENT_METHODS = Object.keys(
  APPOINTMENT_PAYMENT_METHOD_LABELS,
) as AppointmentPaymentMethod[];

export const DEFAULT_APPOINTMENT_PAYMENT_METHOD: AppointmentPaymentMethod = 'CARD';

export const UNSET_PAYMENT_METHOD_LABEL = 'نامشخص';

export const UNSET_PAYMENT_METHOD_FILTER = 'UNSET';

export function formatAppointmentPaymentMethod(
  value: string | null | undefined,
): string {
  if (value == null || value === '') return UNSET_PAYMENT_METHOD_LABEL;
  if (value in APPOINTMENT_PAYMENT_METHOD_LABELS) {
    return APPOINTMENT_PAYMENT_METHOD_LABELS[value as AppointmentPaymentMethod];
  }
  return value;
}

/** Server-side list params. UNSET is a separate boolean so the enum DTO stays strict. */
export function appointmentPaymentFilterParams(
  filter: string,
): Record<string, string> {
  if (!filter || filter === 'ALL') return {};
  if (filter === UNSET_PAYMENT_METHOD_FILTER) return { paymentMethodUnset: 'true' };
  return { paymentMethod: filter };
}
