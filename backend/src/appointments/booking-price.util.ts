/**
 * Desk booking stores Service.price in toman and appointment snapshots in rial.
 * The established conversion is Math.floor(price * 10).
 */
export function bookingPriceRialFromServicePrice(price: unknown): number | null {
  const numeric = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.floor(numeric * 10);
}

export function bookingDurationMinFromService(durationMinutes: unknown): number | null {
  const numeric =
    typeof durationMinutes === 'number' ? durationMinutes : Number(durationMinutes);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}
