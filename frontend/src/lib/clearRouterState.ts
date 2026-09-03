/**
 * Clear stale Next.js router keys once if present.
 * Avoid continuous clearing — App Router needs session state for soft navigation.
 */
export function clearRouterState() {
  if (typeof window === 'undefined') return

  try {
    const staleKeys = [
      '__next_router_state',
      '__next_router_prefetch',
      '__next_router_scroll',
      '__next_router_cache',
    ]

    for (const key of staleKeys) {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    }
  } catch (error) {
    console.warn('Could not clear router state:', error)
  }
}

/**
 * Clear all browser storage related to the app
 */
export function clearAllAppStorage() {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.clear()

    const keysToKeep = ['theme', 'language', 'user-preferences', 'token', 'user']
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && !keysToKeep.includes(key)) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((key) => {
      localStorage.removeItem(key)
    })
  } catch (error) {
    console.warn('Could not clear app storage:', error)
  }
}

/**
 * Optional one-shot cleanup. Do not attach visibility/beforeunload listeners.
 */
export function initializeRouterStateCleanup() {
  if (typeof window === 'undefined') return

  const FLAG = 'doocard_router_cleared_v2'
  try {
    if (!sessionStorage.getItem(FLAG)) {
      clearRouterState()
      sessionStorage.setItem(FLAG, '1')
    }
  } catch {
    // ignore
  }
}
