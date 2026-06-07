"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { RoleBasedSidebar } from "@/components/RoleBasedSidebar"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { getCurrentUser } from '@/lib/auth'
import { subscribeAuthDegraded, isAuthDegraded } from '@/lib/axios'
import Footer from '@/components/Footer'
import NotificationProvider from '@/components/NotificationProvider'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import GlobalErrorHandler from '@/components/common/GlobalErrorHandler'
import NotificationPrompt from '@/components/NotificationPrompt'

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
  const [authDegraded, setAuthDegraded] = useState(false)

  // Check if user is authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (currentUser) {
          setUser(currentUser)
        }
      } catch (error) {
        console.error('Auth error:', error)
      }
    }
    checkAuth()
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

  // Close sidebar on any route change (single central fix for all panels)
  useEffect(() => {
    if (isSidebarOpen) {
      closeMobileSidebar()
    }
  }, [pathname])

  // Prevent hydration mismatch
  if (!mounted) {
    return null
  }

  if (!user) {
    return null
  }

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <GlobalErrorHandler />
        <div className="min-h-screen bg-background">
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
          {/* Mobile Overlay */}
          <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={closeMobileSidebar}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: isMobile ? 320 : 0 }}
            animate={{ x: 0 }}
            exit={{ x: isMobile ? 320 : 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`
              fixed right-0 top-0 z-50 h-full
              ${isMobile ? 'w-80' : 'w-80'}
              ${!isSidebarOpen && !isMobile ? 'hidden' : ''}
            `}
          >
            <RoleBasedSidebar 
              isCollapsed={isSidebarCollapsed} 
              onToggle={closeMobileSidebar}
              isMobile={isMobile}
              userRole={user?.role}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`
        transition-all duration-300 ease-out
        ${isSidebarOpen && !isMobile ? 'lg:mr-80' : 'lg:mr-20'}
      `}>
        {/* Page Content */}
        <main className="p-6 lg:p-8 min-h-screen flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      
      {/* Push Notification Prompt (modal handles its own positioning) */}
      <NotificationPrompt />
      
      <Footer />

      {/* Mobile Sidebar Toggle */}
      {isMobile && (
        <Button
          variant="primary"
          size="icon"
          onClick={toggleSidebar}
          className="fixed bottom-6 left-6 z-50 shadow-glow lg:hidden h-12 w-12"
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      )}
        </div>
      </NotificationProvider>
    </ErrorBoundary>
  )
}