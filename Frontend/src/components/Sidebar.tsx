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
  UserCog, // آیکون جدید برای مدیریت کاربران
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoutButton } from './LogoutButton'

const menuItems = [
  {
    title: 'داشبورد',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'نوبت‌ها',
    href: '/appointments',
    icon: Calendar,
  },
  {
    title: 'مشتریان',
    href: '/dashboard/customers',
    icon: Users,
  },
  {
    title: 'مدیریت کاربران',
    href: '/dashboard/admin/users',
    icon: UserCog, // آیکون مناسب مدیریت کاربران
  },
  {
    title: 'مدیریت دسترسی کاربران',
    href: '/dashboard/admin/permissions',
    icon: ShieldCheck,
  },
  {
    title: 'پیامک‌ها',
    href: '/dashboard/sms',
    icon: MessageSquare,
  },
  {
    title: 'خدمات',
    href: '/services',
    icon: Scissors,
  },
  {
    title: 'حسابداری',
    href: '/dashboard/accounting',
    icon: DollarSign,
  },
  {
    title: 'تنظیمات',
    href: '/dashboard/settings',
    icon: Settings,
  },
  {
    title: 'اعلان‌ها',
    href: '/notifications',
    icon: Bell,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex h-[60px] items-center border-b px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Scissors className="h-6 w-6" />
          <span>آرایشگاه</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-2">
        <nav className="grid items-start px-4 text-sm font-medium">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-gray-500 transition-all hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-50',
                  pathname === item.href &&
                    'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <LogoutButton />
      </div>
    </div>
  )
}