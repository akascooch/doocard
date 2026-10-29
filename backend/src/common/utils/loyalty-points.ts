/**
 * Unified loyalty points from settled appointment spend.
 * Money in storage is RIAL; UI/business rule uses TOMAN (rial / 10).
 * Points = floor(totalPaidToman / 1_000_000) * 5
 */
export function pointsFromPaidAppointmentRial(amountRial: bigint | number | string | null | undefined): number {
  if (amountRial == null) return 0;
  let rial: bigint;
  try {
    rial = typeof amountRial === 'bigint' ? amountRial : BigInt(String(amountRial).replace(/[^\d-]/g, '') || '0');
  } catch {
    return 0;
  }
  if (rial <= 0n) return 0;
  const toman = rial / 10n;
  return Number((toman / 1_000_000n) * 5n);
}

export const PUBLIC_CUSTOMER_ID = 1;
