"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { RoleBasedSidebar } from "@/components/RoleBasedSidebar"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { Button } from "@/components/ui/button"
import { getCurrentUser } from '@/lib/auth'
import { subscribeAuthDegraded, isAuthDegraded } from '@/lib/axios'
import Footer from '@/components/Footer'
import NotificationProvider from '@/components/NotificationProvider'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import GlobalErrorHandler from '@/components/common/GlobalErrorHandler'
import NotificationPrompt from '@/components/NotificationPrompt'
import { isOfflineModeEnabled } from '@/lib/offline/feature-flag'
import { runOfflineSync } from '@/lib/offline/sync-worker'
import { startConnectivityPolling } from '@/lib/offline/connectivity'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [authDegraded, setAuthDegraded] = useState(false)

  // Check if user is authenticated
  useEffect(() => {
    try {
      const currentUser = getCurrentUser()
      if (currentUser) {
        setUser(currentUser)
      } else {
        router.replace('/login')
      }
    } catch (error) {
      console.error('Auth error:', error)
      router.replace('/login')
    } finally {
      setAuthChecked(true)
    }
  }, [router])

  // Subscribe to global auth-degraded signal (non-persistent, per-session)
  useEffect(() => {
    // Initialize from current flag in case degradation happened before mount
    if (isAuthDegraded()) {
      setAuthDegraded(true)
    }
    const unsubscribe = subscribeAuthDegraded(() => {
      setAuthDegraded(true)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  // Handle responsive behavior
  useEffect(() => {
    if (!mounted) return; // Don't run until mounted
    
    const handleResize = () => {
      const isMobileView = (globalThis as any).window?.innerWidth < 1024
      setIsMobile(isMobileView)
      if (isMobileView) {
        setIsSidebarOpen(false)
        setIsSidebarCollapsed(false)
      } else {
        setIsSidebarOpen(true)
        setIsSidebarCollapsed(false)
      }
    }

    handleResize()
    const win = globalThis as any;
    if (win.window) {
      win.window.addEventListener('resize', handleResize)
      return () => win.window.removeEventListener('resize', handleResize)
    }
  }, [mounted])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !isOfflineModeEnabled()) return
    void runOfflineSync()
    return startConnectivityPolling(() => {
      void runOfflineSync()
    })
  }, [mounted])

  const toggleSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(!isSidebarOpen)
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed)
    }
  }

  const closeMobileSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }

  const isSidebarOpenRef = useRef(isSidebarOpen)
  isSidebarOpenRef.current = isSidebarOpen
  const isMobileRef = useRef(isMobile)
  isMobileRef.current = isMobile

  // Close sidebar on any route change (single central fix for all panels)
  useEffect(() => {
    if (isSidebarOpenRef.current && isMobileRef.current) {
      setIsSidebarOpen(false)
    }
  }, [pathname])

  // Prevent hydration mismatch / blank stuck screen while auth resolves
  if (!mounted || !authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">در حال انتقال به صفحه ورود...</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <GlobalErrorHandler />
        <div className="aurora-dashboard-canvas min-h-screen bg-[#09090b] text-zinc-100">
          {/* Auth degraded banner (session-only, non-destructive) */}
          {authDegraded && (
            <div className="fixed top-0 inset-x-0 z-40 flex justify-center px-4 pt-4">
              <div className="w-full max-w-3xl rounded-xl border border-amber-300 bg-amber-50/95 text-amber-900 shadow-md flex flex-col md:flex-row md:items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm md:text-base">
                    نشست شما منقضی شده یا اعتبار آن کاهش یافته است.
                  </p>
                  <p className="text-xs md:text-sm text-amber-800 mt-1">
                    برای ادامه‌ی استفاده‌ی پایدار از امکانات، پیشنهاد می‌شود دوباره وارد شوید.
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end md:self-auto">
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() => router.push('/login')}
                  >
                    ورود مجدد
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-amber-800 hover:bg-amber-100"
                    onClick={() => setAuthDegraded(false)}
                  >
                    بستن
                  </Button>
                </div>
              </div>
            </div>
          )}
          <DashboardShell
            pathname={pathname}
            isMobile={isMobile}
            isSidebarOpen={isSidebarOpen}
            isSidebarCollapsed={isSidebarCollapsed}
            onOverlayClick={closeMobileSidebar}
            onToggleSidebar={toggleSidebar}
            userName={user?.name}
            userRole={user?.role}
            sidebar={
              <RoleBasedSidebar
                isCollapsed={isSidebarCollapsed}
                onToggle={closeMobileSidebar}
                isMobile={isMobile}
                userRole={user?.role}
              />
            }
          >
            {children}
          </DashboardShell>

          <NotificationPrompt />
          <Footer />
        </div>
      </NotificationProvider>
    </ErrorBoundary>
  )
}