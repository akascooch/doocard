/** Public (non-staff) online booking cannot start sooner than this. */
export const PUBLIC_BOOKING_LEAD_MS = 2 * 60 * 60 * 1000

export const PUBLIC_BOOKING_LEAD_HINT_FA =
  'رزرو آنلاین حداقل از ۲ ساعت آینده امکان‌پذیر است'

export function isWithinPublicBookingLeadWindow(
  isoTime: string,
  nowMs = Date.now(),
): boolean {
  const at = new Date(isoTime).getTime()
  if (!Number.isFinite(at)) return true
  return at < nowMs + PUBLIC_BOOKING_LEAD_MS
}

export function isPublicLeadBlockedSlot(
  slot: { time: string; available?: boolean; reason?: string },
  nowMs = Date.now(),
): boolean {
  if (slot.reason === 'min_2h' || slot.reason === 'past') return true
  return isWithinPublicBookingLeadWindow(slot.time, nowMs)
}
