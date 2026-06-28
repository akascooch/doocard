/**
 * Clear non-auth browser cache without wiping login session data.
 */

const PRESERVED_LOCAL_STORAGE_KEYS = new Set(['token', 'user', 'theme', 'language', 'user-preferences']);

const PRESERVED_SESSION_STORAGE_KEYS = new Set([
  'financialReportsAccessToken',
  'financialReportsAccessExpiresAt',
]);

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
    if (key && !PRESERVED_SESSION_STORAGE_KEYS.has(key)) {
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

    if ('indexedDB' in window) {
      indexedDB.databases?.().then((databases) => {
        databases.forEach((db) => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      }).catch(() => {
        // Ignore errors
      });
    }

    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          caches.delete(cacheName);
        });
      }).catch(() => {
        // Ignore errors
      });
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      }).catch(() => {
        // Ignore errors
      });
    }

    console.log('Browser cache cleared (auth session preserved)');
  } catch (error) {
    console.warn('Could not clear browser cache:', error);
  }
}

export function forceReload() {
  if (typeof window === 'undefined') return;

  clearAllBrowserCache();
  window.location.reload();
}

export function initializeCacheClearing() {
  if (typeof window === 'undefined') return;

  clearAllBrowserCache();

  const timestamp = Date.now();
  const meta = document.createElement('meta');
  meta.setAttribute('name', 'cache-timestamp');
  meta.setAttribute('content', timestamp.toString());
  document.head.appendChild(meta);

  window.addEventListener('beforeunload', clearAllBrowserCache);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearAllBrowserCache();
    }
  });
}

export function addCacheBusting(url: string): string {
  const timestamp = Date.now();
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${timestamp}`;
}
