/**
 * Clear Next.js router state from browser storage
 * This helps resolve "router state header" parsing errors
 */
export function clearRouterState() {
  if (typeof window === 'undefined') return

  try {
    // Clear session storage
    sessionStorage.removeItem('__next_router_state')
    sessionStorage.removeItem('__next_router_prefetch')
    sessionStorage.removeItem('__next_router_scroll')
    sessionStorage.removeItem('__next_router_cache')
    
    // Clear local storage
    localStorage.removeItem('__next_router_state')
    localStorage.removeItem('__next_router_prefetch')
    localStorage.removeItem('__next_router_scroll')
    localStorage.removeItem('__next_router_cache')
    
    // Clear any other Next.js related storage
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.includes('__next')) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key)
    })
    
    console.log('Router state cleared successfully')
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
    // Clear all session storage
    sessionStorage.clear()
    
    // Clear specific local storage items (keep user preferences)
    const keysToKeep = ['theme', 'language', 'user-preferences']
    const keysToRemove = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && !keysToKeep.includes(key)) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
    })
    
    console.log('App storage cleared successfully')
  } catch (error) {
    console.warn('Could not clear app storage:', error)
  }
}

/**
 * Initialize router state cleanup on app start
 */
export function initializeRouterStateCleanup() {
  if (typeof window === 'undefined') return

  // Clear router state on page load
  clearRouterState()
  
  // Clear router state on page unload
  window.addEventListener('beforeunload', clearRouterState)
  
  // Clear router state on visibility change (when tab becomes active)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      clearRouterState()
    }
  })
}
