/**
 * Canonical unit at the service → appointment boundary: IRR (rial).
 * Admin MoneyInput already stores Service.price as rial (typed toman × 10).
 * Appointment snapshots use that same rial amount. Do not multiply by 10 again.
 */
export const SERVICE_PRICE_UNIT = 'RIAL' as const;

export function bookingPriceRialFromServicePrice(price: unknown): number | null {
  const numeric = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric);
}

export function bookingDurationMinFromService(durationMinutes: unknown): number | null {
  const numeric =
    typeof durationMinutes === 'number' ? durationMinutes : Number(durationMinutes);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}
