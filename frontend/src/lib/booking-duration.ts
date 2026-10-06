/** Used only when the selected service has no positive duration. */
export const FALLBACK_BOOKING_DURATION_MIN = 60;

const MAX_DURATION_MIN = 24 * 60;

type DurationSource = {
  durationMinutes?: number | null;
  duration?: number | null;
};

/**
 * Duration that must be used for both slot availability and the create payload.
 * A selected service with a valid duration is never replaced by the 60-minute fallback.
 */
export function effectiveServiceDurationMin(
  service: DurationSource | null | undefined,
): number {
  const raw = service?.durationMinutes ?? service?.duration;
  const minutes = typeof raw === 'number' ? raw : Number(raw);
  if (Number.isInteger(minutes) && minutes > 0 && minutes <= MAX_DURATION_MIN) {
    return minutes;
  }
  return FALLBACK_BOOKING_DURATION_MIN;
}

export function effectiveServicesDurationMin(
  services: DurationSource[] | null | undefined,
): number {
  if (!services || services.length === 0) {
    return FALLBACK_BOOKING_DURATION_MIN;
  }
  return services.reduce((sum, service) => sum + effectiveServiceDurationMin(service), 0);
}
