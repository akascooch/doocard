'use client'

import { ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardTopbar } from '@/components/layout/DashboardTopbar'

type DashboardShellProps = {
  children: ReactNode
  sidebar: ReactNode
  pathname: string
  isMobile: boolean
  isSidebarOpen: boolean
  isSidebarCollapsed: boolean
  onOverlayClick: () => void
  onToggleSidebar: () => void
  userName?: string | null
  userRole?: string | null
}

export function DashboardShell({
  children,
  sidebar,
  pathname,
  isMobile,
  isSidebarOpen,
  isSidebarCollapsed: _isSidebarCollapsed,
  onOverlayClick,
  onToggleSidebar,
  userName,
  userRole,
}: DashboardShellProps) {
  const menuOpenLabel = isSidebarOpen ? 'بستن منو' : 'باز کردن منو'

  return (
    <div
      className="aurora-dashboard-canvas dark relative min-h-screen text-zinc-100 selection:bg-white/30"
      data-theme="dark"
    >
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent"
      />

      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onOverlayClick}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ x: isMobile ? 320 : 0 }}
            animate={{ x: 0 }}
            exit={{ x: isMobile ? 320 : 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-0 z-50 h-full overflow-hidden shadow-2xl lg:rounded-none ${
              isMobile ? 'w-80' : 'w-72'
            }`}
          >
            {sidebar}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`relative z-10 min-h-screen transition-all duration-300 ease-out ${
          isSidebarOpen && !isMobile ? 'lg:mr-72' : 'lg:mr-0'
        }`}
      >
        <DashboardTopbar
          userName={userName}
          userRole={userRole}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={onToggleSidebar}
        />
        <main className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-transparent p-6 pb-28 text-zinc-100 lg:min-h-[calc(100vh-4rem)] lg:p-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {isMobile ? (
        <Button
          variant="primary"
          size="icon"
          type="button"
          onClick={onToggleSidebar}
          aria-label={menuOpenLabel}
          aria-expanded={isSidebarOpen}
          title={menuOpenLabel}
          className="fixed bottom-6 left-4 z-30 h-14 w-14 min-h-14 min-w-14 rounded-full border-2 border-white bg-white text-gray-900 shadow-xl shadow-black/30 hover:bg-zinc-100 active:scale-95"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      ) : null}
    </div>
  )
}
