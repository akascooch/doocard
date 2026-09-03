/** Convert stored IRR (rial) integers to تومان for staff-facing copy. */
export function rialToToman(rial: number | bigint | string | null | undefined): number {
  if (rial == null || rial === '') return 0;
  const n = Number(rial);
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n / 10);
}

export function formatFaAmount(value: number): string {
  return value.toLocaleString('fa-IR');
}

export function settlementBarberNotifyKeys(
  appointmentId: number,
  employeeId: number,
): { relatedEntity: string; dedupeKey: string } {
  const relatedEntity = `appointment.settled:${appointmentId}:emp:${employeeId}`;
  return { relatedEntity, dedupeKey: `${relatedEntity}:sms` };
}

export function resolveSettlementToman(appointment: {
  amount?: number | bigint | string | null;
  barberPayoutGrossAmount?: number | bigint | string | null;
  barberPayoutNetAmount?: number | bigint | string | null;
}, fallbackAmountRial?: number): { grossToman: number; netToman: number } {
  const grossRial =
    appointment.barberPayoutGrossAmount ?? fallbackAmountRial ?? appointment.amount ?? 0;
  const netRial = appointment.barberPayoutNetAmount ?? grossRial;
  return {
    grossToman: rialToToman(grossRial),
    netToman: rialToToman(netRial),
  };
}
