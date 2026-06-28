const TTL_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

/**
 * Parse TTL strings (e.g. 60s, 15m, 24h, 365d) or plain numeric seconds to milliseconds.
 * Returns fallbackMs when input is invalid.
 */
export function parseTtlToMilliseconds(
  ttl: string | number | undefined | null,
  fallbackMs: number,
): number {
  if (typeof ttl === 'number' && Number.isFinite(ttl) && ttl > 0) {
    return ttl * 1000;
  }

  if (typeof ttl !== 'string' || !ttl.trim()) {
    return fallbackMs;
  }

  const trimmed = ttl.trim();

  if (/^\d+$/.test(trimmed)) {
    const seconds = parseInt(trimmed, 10);
    return seconds > 0 ? seconds * 1000 : fallbackMs;
  }

  const match = trimmed.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return fallbackMs;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const unitMs = TTL_UNIT_MS[unit];

  if (value <= 0 || !unitMs) {
    return fallbackMs;
  }

  return value * unitMs;
}

export function addTtlToDate(
  ttl: string | number | undefined | null,
  fallbackMs: number,
  from: Date = new Date(),
): Date {
  const ms = parseTtlToMilliseconds(ttl, fallbackMs);
  return new Date(from.getTime() + ms);
}
