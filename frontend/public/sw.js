/**
 * Doocard service worker
 * - Keeps install/activate + no-op fetch (no offline caching)
 * - Handles Web Push display + notification click navigation
 *
 * Backend payload shape (JSON):
 * { title, body, icon?, badge?, data?: { url?, timestamp?, ... } }
 */
const VERSION = '2.0.3.7';
const SW_NAME = `doocard-sw-${VERSION}`;
const DEFAULT_ICON = '/logo/logo-512.png';
const DEFAULT_URL = '/dashboard';

const log = (...args) => {
  try {
    console.log('[SW]', ...args);
  } catch (_) {
    // Ignore logging issues
  }
};

function toUrlSafeBase64(buffer) {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Persist a PushSubscription to the backend.
 * Uses the httpOnly access cookie (credentials: 'include').
 * If the short-lived access cookie expired, rotates via /auth/refresh
 * (httpOnly refresh cookie) and retries once — no tokens stored in the SW.
 */
async function syncSubscriptionToBackend(subscription) {
  const body = JSON.stringify({
    endpoint: subscription.endpoint,
    keys: {
      p256dh: toUrlSafeBase64(subscription.getKey('p256dh')),
      auth: toUrlSafeBase64(subscription.getKey('auth')),
    },
  });

  const postSubscribe = () =>
    fetch('/api/push-notifications/subscribe', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

  let response = await postSubscribe();
  if (response.status !== 401) {
    return response;
  }

  log('subscribe returned 401 — attempting refresh cookie rotation');
  const refreshResponse = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!refreshResponse.ok) {
    log('refresh failed during pushsubscriptionchange', refreshResponse.status);
    return response;
  }

  return postSubscribe();
}

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

self.addEventListener('push', (event) => {
  log('push received');

  let payload = {
    title: 'Doocard',
    body: 'یک اعلان جدید دریافت شد',
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    data: { url: DEFAULT_URL },
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        ...payload,
        ...parsed,
        data: {
          url: DEFAULT_URL,
          ...(payload.data || {}),
          ...(parsed.data || {}),
        },
      };
    }
  } catch (error) {
    console.warn('[SW] push JSON parse failed', error);
    try {
      if (event.data) {
        payload.body = event.data.text() || payload.body;
      }
    } catch (_) {
      // Keep defaults
    }
  }

  const uniqueTag = `doocard-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const notificationOptions = {
    body: payload.body || 'یک اعلان جدید دریافت شد',
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_ICON,
    data: payload.data || { url: DEFAULT_URL },
    tag: payload.tag || uniqueTag,
    requireInteraction: false,
    renotify: true,
    silent: false,
    dir: 'rtl',
    lang: 'fa',
    timestamp: Date.now(),
    actions: [
      { action: 'open', title: 'مشاهده' },
      { action: 'close', title: 'بستن' },
    ],
  };

  event.waitUntil(
    self.registration
      .showNotification(payload.title || 'Doocard', notificationOptions)
      .catch((error) => {
        console.error('[SW] showNotification failed', error);
        return self.registration.showNotification('Doocard', {
          body: 'شما یک اعلان جدید دارید',
          icon: DEFAULT_ICON,
          badge: DEFAULT_ICON,
          data: { url: DEFAULT_URL },
          tag: uniqueTag,
        });
      })
  );
});

self.addEventListener('notificationclick', (event) => {
  log('notificationclick', event.action);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const rawUrl =
    (event.notification.data && event.notification.data.url) || DEFAULT_URL;
  const fullUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === fullUrl && 'focus' in client) {
            return client.focus();
          }
        }

        for (const client of clientList) {
          if (
            client.url.includes(self.location.origin) &&
            'focus' in client &&
            'navigate' in client
          ) {
            return client.focus().then(() => client.navigate(fullUrl));
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }

        return undefined;
      })
      .catch((error) => {
        console.error('[SW] notificationclick failed', error);
      })
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) {
    return;
  }

  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
        )
        .then(() => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({ success: true });
          }
        })
        .catch((error) => {
          if (event.ports && event.ports[0]) {
            event.ports[0].postMessage({
              success: false,
              error: error && error.message ? error.message : 'clear failed',
            });
          }
        })
    );
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('pushsubscriptionchange', (event) => {
  log('pushsubscriptionchange');

  const oldOptions =
    event.oldSubscription && event.oldSubscription.options
      ? event.oldSubscription.options
      : null;

  if (!oldOptions || !oldOptions.applicationServerKey) {
    log('pushsubscriptionchange skipped: missing applicationServerKey');
    return;
  }

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: oldOptions.applicationServerKey,
      })
      .then((newSubscription) => syncSubscriptionToBackend(newSubscription))
      .then((response) => {
        if (!response || !response.ok) {
          log(
            'pushsubscriptionchange sync failed',
            response ? response.status : 'no-response'
          );
        } else {
          log('pushsubscriptionchange sync ok');
        }
      })
      .catch((error) => {
        console.error('[SW] pushsubscriptionchange resubscribe failed', error);
      })
  );
});

log(`boot ${SW_NAME}`);
