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
  Package,
  ShoppingBag,
  Wallet,
  Target,
  Activity,
  Gift,
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
    title: 'تنخواه و هزینه شخصی',
    href: '/dashboard/admin/personal-expenses',
    icon: Wallet,
    description: 'هزینه‌های روزمره مدیر'
  },
  {
    title: 'مدیریت قورباغه (تمرکز روز)',
    href: '/dashboard/admin/frog-tasks',
    icon: Target,
    description: 'چند تسک روزانه با یادآوری پیامکی'
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
    title: 'بدهکاران',
    href: '/dashboard/admin/debtors',
    icon: CreditCard,
    description: 'مشتریان دارای بدهی باز'
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
    title: 'محصولات',
    href: '/dashboard/admin/products',
    icon: Package,
    description: 'کاتالوگ و موجودی فروشگاه'
  },
  {
    title: 'مدیریت پکیج‌ها و طرح‌ها',
    href: '/dashboard/admin/packages',
    icon: Gift,
    description: 'پکیج جلسات و امتیاز وفاداری'
  },
  {
    title: 'سفارشات',
    href: '/dashboard/admin/orders',
    icon: ShoppingBag,
    description: 'سفارش‌های فروشگاه و رسید کارت‌به‌کارت'
  },
  {
    title: 'حسابداری',
    href: '/dashboard/admin/accounting',
    icon: CreditCard,
    description: 'مدیریت تراکنش‌ها و حساب‌ها'
  },
  {
    title: 'انعام',
    href: '/dashboard/admin/tips',
    icon: DollarSign,
    description: 'ثبت و گزارش انعام'
  },
  {
    title: 'گزارشات مالی',
    href: '/dashboard/admin/financial',
    icon: DollarSign,
    description: 'گزارشات مالی و حسابداری'
  },
  {
    title: 'حقوق کارمندان',
    href: '/dashboard/admin/employee-salary',
    icon: CreditCard,
    description: 'محاسبه سهم کارمند و پلتفرم'
  },
  {
    title: 'ایمپورت دیتا',
    href: '/dashboard/admin/import',
    icon: Upload,
    description: 'وارد کردن داده‌ها از Excel'
  },
  {
    title: 'اعلان‌ها',
    href: '/dashboard/admin/notifications',
    icon: Bell,
    description: 'ارسال و مدیریت اعلان‌ها'
  },
  {
    title: 'پیامک',
    href: '/dashboard/admin/sms',
    icon: MessageSquare,
    description: 'ارسال، قالب‌ها و گزارش SMS'
  },
  {
    title: 'مانیتورینگ سرور',
    href: '/dashboard/admin/monitoring',
    icon: Activity,
    description: 'سلامت سرور، دیتابیس و Redis'
  },
  {
    title: 'تنظیمات',
    href: '/dashboard/settings',
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
    title: 'مشتریان من',
    href: '/dashboard/employee/my-customers',
    icon: Users,
    description: 'مشتریان اختصاص‌یافته به من'
  },
  {
    title: 'ثبت مشتری',
    href: '/dashboard/employee/register-customer',
    icon: UserPlus,
    description: 'ثبت سریع مشتری با نام و موبایل'
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

const serviceMenuItems = [
  {
    title: 'داشبورد',
    href: '/dashboard/employee',
    icon: LayoutDashboard,
    description: 'نمای کلی'
  },
  {
    title: 'مشتریان من',
    href: '/dashboard/employee/my-customers',
    icon: Users,
    description: 'مشتریان اختصاص‌یافته به من'
  },
  {
    title: 'ثبت مشتری',
    href: '/dashboard/employee/register-customer',
    icon: UserPlus,
    description: 'ثبت سریع مشتری با نام و موبایل'
  },
  {
    title: 'درخواست حقوق / انعام',
    href: '/dashboard/employee/salary-request',
    icon: CreditCard,
    description: 'موجودی انعام و درخواست پرداخت'
  },
  {
    title: 'تنظیمات',
    href: '/dashboard/employee/settings',
    icon: Settings,
    description: 'تنظیمات پروفایل'
  },
]

const accountantMenuItems = [
  {
    title: 'داشبورد',
    href: '/dashboard/admin',
    icon: LayoutDashboard,
    description: 'نمای کلی'
  },
  {
    title: 'حسابداری',
    href: '/dashboard/admin/accounting',
    icon: CreditCard,
    description: 'تراکنش‌ها و حساب‌ها'
  },
  {
    title: 'انعام',
    href: '/dashboard/admin/tips',
    icon: DollarSign,
    description: 'گزارش انعام'
  },
  {
    title: 'حقوق کارمندان',
    href: '/dashboard/admin/employee-salary',
    icon: DollarSign,
    description: 'تسویه و درخواست‌های حقوق'
  },
  {
    title: 'گزارشات مالی',
    href: '/dashboard/admin/financial',
    icon: BarChart3,
    description: 'گزارشات مالی'
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
    title: 'پکیج و امتیاز',
    href: '/dashboard/customer/packages',
    icon: Gift,
    description: 'جلسات باقی‌مانده و وفاداری'
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
      case 'ACCOUNTANT':
        return accountantMenuItems
      case 'EMPLOYEE':
        return employeeMenuItems
      case 'SERVICE':
        return serviceMenuItems
      case 'CUSTOMER':
      default:
        return customerMenuItems
    }
  }

  const menuItems = getMenuItems()

  return (
    <div 
      className={cn(
        "flex h-full flex-col gap-4 bg-black border-l border-white/10 transition-all duration-300 ease-out shadow-2xl selection:bg-white/30",
        isCollapsed && !isHovered ? "w-20" : "w-72",
        isMobile && "w-80"
      )}
      onMouseEnter={() => !isCollapsed && setIsHovered(true)}
      onMouseLeave={() => !isCollapsed && setIsHovered(false)}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        <Link href="/" className="flex items-center gap-3 font-semibold text-white/60 transition-colors duration-200 hover:text-white">
          <div className="w-10 h-10">
            <AppLogo size="sm" animated={false} />
          </div>
          {(!isCollapsed || isHovered) && !isMobile && (
            <span className="text-xl font-semibold tracking-tight">Doocard</span>
          )}
        </Link>
        {isMobile && onToggle && (
          <button
            onClick={onToggle}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors duration-200"
          >
            <X className="h-6 w-6 text-white/70" />
          </button>
        )}
      </div>

      {/* Role Badge */}
      {(!isCollapsed || isHovered) && !isMobile && (
        <div className="px-4 animate-fade-in">
          <div 
            className={cn(
              "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-extrabold shadow-lg ring-1 ring-white/20",
              userRole === 'ADMIN' && "bg-gradient-to-r from-purple-400 to-pink-400",
              userRole === 'ACCOUNTANT' && "bg-gradient-to-r from-amber-400 to-orange-400",
              userRole === 'EMPLOYEE' && "bg-gradient-to-r from-blue-400 to-cyan-400",
              userRole === 'SERVICE' && "bg-gradient-to-r from-teal-400 to-emerald-400",
              userRole === 'CUSTOMER' && "bg-gradient-to-r from-green-400 to-teal-400"
            )}
            style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
          >
            {userRole === 'ADMIN' && 'مدیر سیستم'}
            {userRole === 'ACCOUNTANT' && 'حسابدار'}
            {userRole === 'EMPLOYEE' && 'کارمند'}
            {userRole === 'SERVICE' && 'پرسنل خدمات'}
            {userRole === 'CUSTOMER' && 'مشتری'}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-auto scrollbar-doocard py-4">
        <nav className="space-y-1.5 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard/admin' &&
                item.href !== '/dashboard/employee' &&
                item.href !== '/dashboard/customer' &&
                pathname.startsWith(item.href + '/'))
            const isVisible = !isCollapsed || isHovered || isMobile
            
            return (
              <Link
                key={item.href}
                href={item.href}
                data-cy={`nav-${item.href}`}
                className={cn(
                  'group relative flex items-center gap-4 rounded-2xl px-4 py-3 text-sm font-medium transition-colors duration-200',
                  isActive 
                    ? 'border border-white bg-white text-black shadow-sm' 
                    : 'border border-transparent bg-transparent text-white/80 hover:border-white/10 hover:bg-[#1A1A1A] hover:text-white',
                  isCollapsed && !isHovered && !isMobile && 'justify-center px-2'
                )}
                title={isCollapsed && !isHovered && !isMobile ? item.title : undefined}
              >
                {isActive && (
                  <span className="absolute inset-y-2 right-1 w-0.5 rounded-full bg-black" aria-hidden />
                )}
                <Icon className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors duration-200",
                  isActive ? "text-black" : "text-white/70 group-hover:text-white"
                )} />
                {isVisible && (
                  <div className="flex-1 min-w-0">
                    <span className="block font-semibold tracking-tight">{item.title}</span>
                    {(!isCollapsed || isHovered) && !isMobile && (
                      <span className={cn(
                        "mt-0.5 block text-xs leading-relaxed",
                        isActive ? "text-black/50" : "text-white/40"
                      )}>
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
      <div className="mt-auto border-t border-white/10 p-4">
        <LogoutButton isCollapsed={isCollapsed} isHovered={isHovered} isMobile={isMobile} />
      </div>
    </div>
  )
}
