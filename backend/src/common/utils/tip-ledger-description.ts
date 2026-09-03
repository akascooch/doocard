import { TipRecipientType } from '@prisma/client';
import { formatJalaliFromUtcInstant } from './tehran-business-day';

/** Ledger description for appointment-sourced TIP transactions. */
export function buildAppointmentTipDescription(params: {
  appointmentId: number;
  customerName?: string | null;
  barberName?: string | null;
  tipRecipientType?: TipRecipientType | string | null;
}): string {
  const customer = (params.customerName || '').trim() || 'نامشخص';
  const barber = (params.barberName || '').trim() || 'نامشخص';
  const tipType =
    params.tipRecipientType === TipRecipientType.TEAM ||
    params.tipRecipientType === 'TEAM'
      ? 'TEAM'
      : params.tipRecipientType === TipRecipientType.INDIVIDUAL ||
          params.tipRecipientType === 'INDIVIDUAL'
        ? 'INDIVIDUAL'
        : 'نامشخص';
  return `انعام نوبت #${params.appointmentId} - مشتری: ${customer} - آرایشگر: ${barber} - نوع: ${tipType}`;
}

/** Enrich TipSource.note for manual tips with recipient context. */
export function buildManualTipNote(params: {
  tipType: TipRecipientType | string;
  recipientName?: string | null;
  teamMemberNames?: string[];
  existingNote?: string | null;
}): string {
  const tipType =
    params.tipType === TipRecipientType.TEAM || params.tipType === 'TEAM'
      ? 'TEAM'
      : 'INDIVIDUAL';
  let recipientPart: string;
  if (tipType === 'INDIVIDUAL') {
    recipientPart = (params.recipientName || '').trim() || 'نامشخص';
  } else {
    const names = (params.teamMemberNames || [])
      .map((n) => n.trim())
      .filter(Boolean);
    recipientPart = names.length > 0 ? names.join('، ') : 'تیم خدمات';
  }
  const rich = `انعام دستی - گیرنده: ${recipientPart} - نوع: ${tipType}`;
  const existing = (params.existingNote || '').trim();
  if (!existing) return rich;
  if (existing.includes('انعام دستی - گیرنده:')) return existing;
  return `${rich} | ${existing}`;
}

/** True when scheduledAt and paidAt fall on different Tehran civil days. */
export function isSettledOnDifferentTehranDay(
  scheduledAt: Date | null | undefined,
  paidAt: Date | null | undefined,
): boolean {
  if (!scheduledAt || !paidAt) return false;
  return (
    formatJalaliFromUtcInstant(scheduledAt) !==
    formatJalaliFromUtcInstant(paidAt)
  );
}
