/** Offline cashier mode is opt-in only — never enabled by default. */
export function isOfflineModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE;
  if (flag === undefined || flag === null || String(flag).trim() === '') {
    return false;
  }
  return String(flag).trim().toLowerCase() === 'true';
}
