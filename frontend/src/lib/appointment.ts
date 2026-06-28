/**
 * Shared appointment types aligned with backend formatAppointment responses.
 * All tip fields are nullable for historical records.
 */

export type TipRecipientType = 'INDIVIDUAL' | 'TEAM';

export function isTipRecipientType(value: string): value is TipRecipientType {
  return value === 'INDIVIDUAL' || value === 'TEAM';
}

export interface AppointmentServiceSnapshot {
  serviceId: number;
  priceAtBooking: number;
  durationMin: number;
  serviceName?: string;
}

export interface AppointmentTipRecipientEmployee {
  id: number;
  user?: {
    id: number;
    name: string;
    phone?: string;
    email?: string | null;
    role?: string;
  } | null;
}

export interface AppointmentRecord {
  id: number;
  services: AppointmentServiceSnapshot[];
  scheduledAt: string;
  durationMin: number;
  status: string;
  amount?: number | null;
  tipAmount?: number | null;
  tipRecipientType?: TipRecipientType | null;
  tipRecipientEmployeeId?: number | null;
  tipRecipientEmployeeName?: string | null;
  tipRecipientEmployee?: AppointmentTipRecipientEmployee | null;
  tipStaffShareRial?: number | null;
  tipSalonShareRial?: number | null;
  customerName: string;
  employeeName: string;
  employeeId?: number;
  notes?: string;
}

/** Human-readable tip assignment label; safe when fields are null. */
export function formatTipAssignmentLabel(
  appointment: Pick<
    AppointmentRecord,
    'tipAmount' | 'tipRecipientType' | 'tipRecipientEmployeeName'
  >,
): string | null {
  if (!appointment.tipAmount || appointment.tipAmount <= 0) {
    return null;
  }
  if (!appointment.tipRecipientType) {
    return 'بدون تخصیص';
  }
  if (appointment.tipRecipientType === 'TEAM') {
    return 'تیمی';
  }
  return appointment.tipRecipientEmployeeName
    ? `فردی — ${appointment.tipRecipientEmployeeName}`
    : 'فردی';
}

export function getAppointmentServices(
  appointment: Pick<AppointmentRecord, 'services'>,
): AppointmentServiceSnapshot[] {
  return Array.isArray(appointment.services) ? appointment.services : [];
}
