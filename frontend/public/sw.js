const VERSION = '2.0.2';
const SW_NAME = `doocard-sw-${VERSION}`;

const log = (...args) => {
  try {
    console.log('[SW]', ...args);
  } catch (_) {
    // Ignore logging issues
  }
};

self.addEventListener('install', (event) => {
  log(`install ${SW_NAME}`);
  event.waitUntil(
    (async () => {
      try {
        if (self.skipWaiting) {
          await self.skipWaiting();
        }
      } catch (error) {
        console.warn('[SW] skipWaiting failed', error);
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  log(`activate ${SW_NAME}`);
  event.waitUntil(
    (async () => {
      try {
        if (self.clients && self.clients.claim) {
          await self.clients.claim();
        }
      } catch (error) {
        console.warn('[SW] clients.claim failed', error);
      }
    })()
  );
});

// Intentionally no caching or network interception until backend stabilizes
self.addEventListener('fetch', () => {
  // No-op
});

log(`boot ${SW_NAME}`);
