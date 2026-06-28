'use client';

const HEALTH_URL = '/api/health';
const HEALTH_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 30_000;

let lastReachable: boolean | null = null;
const listeners = new Set<(reachable: boolean) => void>();

function notify(reachable: boolean): void {
  if (lastReachable === reachable) return;
  lastReachable = reachable;
  listeners.forEach((l) => {
    try {
      l(reachable);
    } catch {
      // ignore
    }
  });
}

function abortSignalWithTimeout(ms: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return AbortSignal.timeout(ms);
  }
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

export async function checkServerReachability(): Promise<boolean> {
  if (typeof window === 'undefined') return true;
  if (!navigator.onLine) {
    notify(false);
    return false;
  }
  try {
    const res = await fetch(HEALTH_URL, {
      cache: 'no-store',
      signal: abortSignalWithTimeout(HEALTH_TIMEOUT_MS),
    });
    const ok = res.ok;
    notify(ok);
    return ok;
  } catch {
    notify(false);
    return false;
  }
}

export async function isOfflineOperational(): Promise<boolean> {
  const reachable = await checkServerReachability();
  return !reachable;
}

export function subscribeServerReachability(
  listener: (reachable: boolean) => void,
): () => void {
  listeners.add(listener);
  if (lastReachable !== null) {
    listener(lastReachable);
  }
  return () => listeners.delete(listener);
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

export function startConnectivityPolling(onReconnect?: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const runCheck = async () => {
    const was = lastReachable;
    const ok = await checkServerReachability();
    if (was === false && ok && onReconnect) {
      onReconnect();
    }
  };

  void runCheck();

  const onOnline = () => {
    void runCheck();
  };
  window.addEventListener('online', onOnline);

  if (!pollTimer) {
    pollTimer = setInterval(() => {
      void runCheck();
    }, POLL_INTERVAL_MS);
  }

  return () => {
    window.removeEventListener('online', onOnline);
  };
}

export function getLastReachableSnapshot(): boolean | null {
  return lastReachable;
}
