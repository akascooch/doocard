'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Scissors,
  Settings,
  Bell,
  MessageSquare,
  DollarSign,
  UserCog,
  Shield,
  Menu,
  X,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoutButton } from './LogoutButton'
import { useState } from 'react'

const menuItems = [
  {
    title: 'داشبورد',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'نمای کلی سیستم'
  },
  {
    title: 'نوبت‌ها',
    href: '/dashboard/appointments',
    icon: Calendar,
    description: 'مدیریت نوبت‌ها'
  },
  {
    title: 'مشتریان',
    href: '/dashboard/customers',
    icon: Users,
    description: 'لیست مشتریان'
  },
  {
    title: 'کارکنان',
    href: '/dashboard/staff',
    icon: UserCog,
    description: 'مدیریت آرایشگران و خدمات'
  },
  {
    title: 'کاربران',
    href: '/dashboard/admin/users',
    icon: Users,
    description: 'مدیریت کاربران'
  },
  {
    title: 'دسترسی‌ها',
    href: '/dashboard/admin/permissions',
    icon: Shield,
    description: 'مدیریت دسترسی‌ها'
  },
  {
    title: 'پیامک‌ها',
    href: '/dashboard/sms',
    icon: MessageSquare,
    description: 'ارسال پیامک'
  },
  {
    title: 'خدمات',
    href: '/dashboard/services',
    icon: Scissors,
    description: 'مدیریت خدمات'
  },
  {
    title: 'حسابداری',
    href: '/dashboard/accounting',
    icon: DollarSign,
    description: 'گزارشات مالی'
  },
  {
    title: 'تنظیمات',
    href: '/dashboard/settings',
    icon: Settings,
    description: 'تنظیمات سیستم'
  },
  {
    title: 'اعلان‌ها',
    href: '/notifications',
    icon: Bell,
    description: 'اعلان‌های سیستم'
  },
]

interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
  isMobile?: boolean
}

export function Sidebar({ isCollapsed = false, onToggle, isMobile = false }: SidebarProps) {
  const pathname = usePathname()
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div 
      className={cn(
        "flex h-full flex-col gap-6 glass border-r border-border transition-all duration-300 ease-out",
        isCollapsed && !isHovered ? "w-20" : "w-80",
        isMobile && "w-80"
      )}
      onMouseEnter={() => !isCollapsed && setIsHovered(true)}
      onMouseLeave={() => !isCollapsed && setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex h-20 items-center justify-between border-b border-border px-6">
        <Link href="/" className="flex items-center gap-4 font-bold text-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          {(!isCollapsed || isHovered) && !isMobile && (
            <span className="text-xl text-gradient">Doocard</span>
          )}
        </Link>
        {isMobile && onToggle && (
          <button
            onClick={onToggle}
            className="rounded-xl p-2 transition-all duration-200 hover:bg-accent/10 hover:shadow-md active:scale-95"
          >
            <X className="h-6 w-6 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-auto py-4">
        <nav className="space-y-2 px-4">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const isVisible = !isCollapsed || isHovered || isMobile
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ease-out',
                  'hover:bg-accent/10 hover:shadow-sm active:scale-[0.98]',
                  isActive 
                    ? 'bg-gradient-to-r from-primary/20 to-accent/20 text-primary shadow-md border border-primary/20' 
                    : 'text-muted-foreground hover:text-foreground',
                  isCollapsed && !isHovered && !isMobile && 'justify-center px-3'
                )}
                title={isCollapsed && !isHovered && !isMobile ? item.title : undefined}
              >
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-sm" 
                    : "bg-muted/50 text-muted-foreground group-hover:bg-accent/20 group-hover:text-accent-foreground"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                {isVisible && (
                  <div className="flex-1 min-w-0">
                    <span className="block font-semibold">{item.title}</span>
                    {(!isCollapsed || isHovered) && !isMobile && (
                      <span className="text-xs text-muted-foreground mt-1 block leading-relaxed">
                        {item.description}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-border p-4">
        <LogoutButton isCollapsed={isCollapsed} isHovered={isHovered} isMobile={isMobile} />
      </div>
    </div>
  )
}