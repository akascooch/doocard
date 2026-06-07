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
  ShieldCheck,
  Menu,
  X,
  Home,
  BarChart3,
  CreditCard,
  UserPlus,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoutButton } from './LogoutButton'
import { AppLogo } from '@/components/common/AppLogo'
import { useState } from 'react'

interface RoleBasedSidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
  isMobile?: boolean
  userRole?: string
}

// Admin menu items
const adminMenuItems = [
  {
    title: 'داشبورد',
    href: '/dashboard/admin',
    icon: LayoutDashboard,
    description: 'نمای کلی سیستم'
  },
  {
    title: 'مدیریت صفحه اصلی',
    href: '/dashboard/admin/homepage',
    icon: Home,
    description: 'تنظیمات صفحه اصلی'
  },
  {
    title: 'نوبت‌ها',
    href: '/dashboard/admin/appointments',
    icon: Calendar,
    description: 'مدیریت نوبت‌ها'
  },
  {
    title: 'مشتریان',
    href: '/dashboard/admin/customers',
    icon: Users,
    description: 'مدیریت مشتریان'
  },
  {
    title: 'کارکنان',
    href: '/dashboard/admin/employees',
    icon: UserCog,
    description: 'مدیریت کارکنان'
  },
  {
    title: 'کاربران',
    href: '/dashboard/admin/users',
    icon: UserPlus,
    description: 'مدیریت تمام کاربران'
  },
  {
    title: 'خدمات',
    href: '/dashboard/admin/services',
    icon: Scissors,
    description: 'مدیریت خدمات'
  },
  {
    title: 'حسابداری',
    href: '/dashboard/admin/accounting',
    icon: CreditCard,
    description: 'مدیریت تراکنش‌ها و حساب‌ها'
  },
  {
    title: 'گزارشات مالی',
    href: '/dashboard/admin/financial',
    icon: DollarSign,
    description: 'گزارشات مالی و حسابداری'
  },
  {
    title: 'ایمپورت دیتا',
    href: '/dashboard/admin/import',
    icon: Upload,
    description: 'وارد کردن داده‌ها از Excel'
  },
  {
    title: 'تنظیمات',
    href: '/dashboard/admin/settings',
    icon: Settings,
    description: 'تنظیمات سیستم'
  },
]

// Employee menu items
const employeeMenuItems = [
  {
    title: 'داشبورد',
    href: '/dashboard/employee',
    icon: LayoutDashboard,
    description: 'نمای کلی کارهای من'
  },
  {
    title: 'نوبت‌های من',
    href: '/dashboard/employee/appointments',
    icon: Calendar,
    description: 'نوبت‌های اختصاص یافته'
  },
  {
    title: 'درخواست حقوق',
    href: '/dashboard/employee/salary-request',
    icon: CreditCard,
    description: 'درخواست پرداخت حقوق'
  },
  {
    title: 'گزارش عملکرد',
    href: '/dashboard/employee/performance',
    icon: BarChart3,
    description: 'آمار و گزارشات'
  },
  {
    title: 'تنظیمات',
    href: '/dashboard/employee/settings',
    icon: Settings,
    description: 'تنظیمات پروفایل'
  },
]

// Customer menu items
const customerMenuItems = [
  {
    title: 'داشبورد',
    href: '/dashboard/customer',
    icon: LayoutDashboard,
    description: 'نمای کلی حساب کاربری'
  },
  {
    title: 'نوبت‌های من',
    href: '/dashboard/customer/appointments',
    icon: Calendar,
    description: 'نوبت‌های من'
  },
  {
    title: 'رزرو نوبت',
    href: '/dashboard/customer/book-appointment',
    icon: UserPlus,
    description: 'رزرو نوبت جدید'
  },
  {
    title: 'تاریخچه',
    href: '/dashboard/customer/history',
    icon: BarChart3,
    description: 'تاریخچه خدمات'
  },
  {
    title: 'تنظیمات',
    href: '/dashboard/customer/settings',
    icon: Settings,
    description: 'تنظیمات پروفایل'
  },
]

export function RoleBasedSidebar({ isCollapsed = false, onToggle, isMobile = false, userRole = 'CUSTOMER' }: RoleBasedSidebarProps) {
  const pathname = usePathname()
  const [isHovered, setIsHovered] = useState(false)

  // Get menu items based on user role
  const getMenuItems = () => {
    switch (userRole) {
      case 'ADMIN':
        return adminMenuItems
      case 'EMPLOYEE':
        return employeeMenuItems
      case 'CUSTOMER':
      default:
        return customerMenuItems
    }
  }

  const menuItems = getMenuItems()

  return (
    <div 
      className={cn(
        "flex h-full flex-col gap-4 bg-gray-900 dark:bg-card border-l border-gray-700 dark:border-border transition-all duration-300 ease-out shadow-xl",
        isCollapsed && !isHovered ? "w-20" : "w-72",
        isMobile && "w-80"
      )}
      onMouseEnter={() => !isCollapsed && setIsHovered(true)}
      onMouseLeave={() => !isCollapsed && setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-gray-700 dark:border-border px-4">
        <Link href="/" className="flex items-center gap-3 font-semibold text-gray-400 transition-all duration-300 hover:text-gray-300">
          <div className="w-10 h-10">
            <AppLogo size="sm" animated={false} />
          </div>
          {(!isCollapsed || isHovered) && !isMobile && (
            <span className="text-xl font-bold">Doocard</span>
          )}
        </Link>
        {isMobile && onToggle && (
          <button
            onClick={onToggle}
            className="p-2 rounded-xl hover:bg-gray-800 dark:hover:bg-primary/10 transition-all duration-300"
          >
            <X className="h-6 w-6 text-gray-300" />
          </button>
        )}
      </div>

      {/* Role Badge */}
      {(!isCollapsed || isHovered) && !isMobile && (
        <div className="px-4 animate-fade-in">
          <div 
            className={cn(
              "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold shadow-lg",
              userRole === 'ADMIN' && "bg-gradient-to-r from-purple-400 to-pink-400",
              userRole === 'EMPLOYEE' && "bg-gradient-to-r from-blue-400 to-cyan-400",
              userRole === 'CUSTOMER' && "bg-gradient-to-r from-green-400 to-teal-400"
            )}
            style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
          >
            {userRole === 'ADMIN' && 'مدیر سیستم'}
            {userRole === 'EMPLOYEE' && 'کارمند'}
            {userRole === 'CUSTOMER' && 'مشتری'}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-auto scrollbar-doocard py-4">
        <nav className="space-y-1.5 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const isVisible = !isCollapsed || isHovered || isMobile
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-4 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300 ease-out',
                  isActive 
                    ? 'bg-gray-600 text-white shadow-md shadow-gray-600/30' 
                    : 'text-white hover:bg-gray-800 dark:hover:bg-primary/10 hover:text-white dark:hover:text-primary-foreground hover:scale-[1.02]',
                  isCollapsed && !isHovered && !isMobile && 'justify-center px-2'
                )}
                title={isCollapsed && !isHovered && !isMobile ? item.title : undefined}
              >
                <Icon className={cn(
                  "h-5 w-5 flex-shrink-0 transition-all duration-300",
                  isActive ? "text-white" : "text-white group-hover:scale-110"
                )} />
                {isVisible && (
                  <div className="flex-1 min-w-0">
                    <span className="block font-semibold">{item.title}</span>
                    {(!isCollapsed || isHovered) && !isMobile && (
                      <span className="text-xs text-gray-300 mt-0.5 block leading-relaxed">
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
      <div className="mt-auto p-4 border-t border-border">
        <LogoutButton isCollapsed={isCollapsed} isHovered={isHovered} isMobile={isMobile} />
      </div>
    </div>
  )
}
