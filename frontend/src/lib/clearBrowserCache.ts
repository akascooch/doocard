/**
 * Clear all browser cache and storage
 * This ensures the new Doocard frontend is always loaded
 */

export function clearAllBrowserCache() {
  if (typeof window === 'undefined') return

  try {
    // Clear all storage
    localStorage.clear()
    sessionStorage.clear()
    
    // Clear IndexedDB
    if ('indexedDB' in window) {
      indexedDB.databases?.().then(databases => {
        databases.forEach(db => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name)
          }
        })
      }).catch(() => {
        // Ignore errors
      })
    }
    
    // Clear Cache API
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
          caches.delete(cacheName)
        })
      }).catch(() => {
        // Ignore errors
      })
    }
    
    // Clear service worker cache
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister()
        })
      }).catch(() => {
        // Ignore errors
      })
    }
    
    console.log('All browser cache cleared successfully')
  } catch (error) {
    console.warn('Could not clear browser cache:', error)
  }
}

/**
 * Force reload the page with cache bypass
 */
export function forceReload() {
  if (typeof window === 'undefined') return
  
  // Clear cache first
  clearAllBrowserCache()
  
  // Force reload with cache bypass
  window.location.reload()
}

/**
 * Initialize cache clearing on app start
 */
export function initializeCacheClearing() {
  if (typeof window === 'undefined') return

  // Clear cache on page load
  clearAllBrowserCache()
  
  // Add a timestamp to prevent caching
  const timestamp = Date.now()
  const meta = document.createElement('meta')
  meta.setAttribute('name', 'cache-timestamp')
  meta.setAttribute('content', timestamp.toString())
  document.head.appendChild(meta)
  
  // Clear cache on page unload
  window.addEventListener('beforeunload', clearAllBrowserCache)
  
  // Clear cache on visibility change
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearAllBrowserCache()
    }
  })
}

/**
 * Add cache busting to URLs
 */
export function addCacheBusting(url: string): string {
  const timestamp = Date.now()
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_t=${timestamp}`
}
