'use client'

import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import NotificationBell from '@/components/NotificationBell'

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'مدیر سیستم',
  ACCOUNTANT: 'حسابدار',
  EMPLOYEE: 'کارمند',
  SERVICE: 'پرسنل خدمات',
  CUSTOMER: 'مشتری',
}

const ROLE_CHIP: Record<string, string> = {
  ADMIN: 'border-purple-400/30 bg-purple-400/20 text-purple-200',
  ACCOUNTANT: 'border-amber-400/30 bg-amber-400/20 text-amber-200',
  EMPLOYEE: 'border-sky-400/30 bg-sky-400/20 text-sky-200',
  SERVICE: 'border-teal-400/30 bg-teal-400/20 text-teal-200',
  CUSTOMER: 'border-emerald-400/30 bg-emerald-400/20 text-emerald-200',
}

type DashboardTopbarProps = {
  userName?: string | null
  userRole?: string | null
  isSidebarOpen: boolean
  onToggleSidebar: () => void
}

export function DashboardTopbar({
  userName,
  userRole,
  isSidebarOpen,
  onToggleSidebar,
}: DashboardTopbarProps) {
  const menuOpenLabel = isSidebarOpen ? 'بستن منو' : 'باز کردن منو'
  const roleKey = userRole && ROLE_LABELS[userRole] ? userRole : 'CUSTOMER'

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/40 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-3 px-6 lg:h-16 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={menuOpenLabel}
            aria-expanded={isSidebarOpen}
            title={menuOpenLabel}
            className="rounded-xl p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <p className="truncate text-sm font-semibold tracking-tight text-white">
            {userName || 'کاربر'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-tight',
              ROLE_CHIP[roleKey]
            )}
          >
            {ROLE_LABELS[roleKey]}
          </span>
          <NotificationBell />
        </div>
      </div>
    </header>
  )
}
