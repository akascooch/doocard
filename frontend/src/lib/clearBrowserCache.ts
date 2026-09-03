/**
 * Clear non-auth browser cache without wiping login session data
 * or Next.js App Router client state (which breaks soft navigation).
 */

const PRESERVED_LOCAL_STORAGE_KEYS = new Set(['token', 'user', 'theme', 'language', 'user-preferences']);

const PRESERVED_SESSION_STORAGE_KEYS = new Set([
  'financialReportsAccessToken',
  'financialReportsAccessExpiresAt',
]);

function shouldPreserveSessionKey(key: string): boolean {
  if (PRESERVED_SESSION_STORAGE_KEYS.has(key)) return true;
  // Never wipe Next.js internal router/cache keys — clearing them breaks client navigation.
  if (key.includes('__next') || key.startsWith('next-')) return true;
  return false;
}

function clearLocalStorageExceptPreserved() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && !PRESERVED_LOCAL_STORAGE_KEYS.has(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

function clearSessionStorageExceptPreserved() {
  const keysToRemove: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && !shouldPreserveSessionKey(key)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => sessionStorage.removeItem(key));
}

export function clearAllBrowserCache() {
  if (typeof window === 'undefined') return;

  try {
    clearLocalStorageExceptPreserved();
    clearSessionStorageExceptPreserved();

    console.log('Browser cache cleared (auth + Next router state preserved)');
  } catch (error) {
    console.warn('Could not clear browser cache:', error);
  }
}

export function forceReload() {
  if (typeof window === 'undefined') return;

  clearAllBrowserCache();
  window.location.reload();
}

/**
 * One-time soft cache clear on first visit only.
 * Do NOT clear on visibilitychange/beforeunload — that races with App Router transitions.
 */
export function initializeCacheClearing() {
  if (typeof window === 'undefined') return;

  const FLAG = 'doocard_cache_cleared_v2';
  try {
    if (!sessionStorage.getItem(FLAG)) {
      clearAllBrowserCache();
      sessionStorage.setItem(FLAG, '1');
    }
  } catch {
    // ignore storage errors
  }

  const timestamp = Date.now();
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'cache-timestamp');
  meta.setAttribute('content', timestamp.toString());
  document.head.appendChild(meta);
}

export function addCacheBusting(url: string): string {
  const timestamp = Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${timestamp}`;
}
