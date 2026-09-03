'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  UsersIcon, 
  CalendarIcon, 
  CogIcon, 
  ChartBarIcon,
  ScissorsIcon,
  UserGroupIcon,
  BellIcon,
  DocumentTextIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';
import { AppLogo } from './common/AppLogo';

const navigation = [
  { name: 'داشبورد', href: '/dashboard/admin', icon: HomeIcon },
  { name: 'کاربران', href: '/dashboard/admin/users', icon: UsersIcon },
  { name: 'نوبت‌ها', href: '/dashboard/admin/appointments', icon: CalendarIcon },
  { name: 'خدمات', href: '/dashboard/admin/services', icon: ScissorsIcon },
  { name: 'کارکنان', href: '/dashboard/admin/staff', icon: UserGroupIcon },
  { name: 'مشتریان', href: '/dashboard/customers', icon: UsersIcon },
  { name: 'حسابداری', href: '/dashboard/accounting', icon: BanknotesIcon },
  { name: 'گزارشات', href: '/dashboard/admin/reports', icon: ChartBarIcon },
  { name: 'پیامک', href: '/dashboard/admin/sms', icon: BellIcon },
  { name: 'تنظیمات', href: '/dashboard/settings', icon: CogIcon },
];

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {!collapsed && (
            <div className="flex items-center space-x-3 space-x-reverse">
              <div className="w-8 h-8">
                <AppLogo size="sm" animated={false} />
              </div>
              <span className="text-lg font-bold text-gray-800">پنل مدیریت</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 space-x-reverse p-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        {!collapsed && (
          <div className="p-4 border-t">
            <div className="text-sm text-gray-500 text-center">
              نسخه 1.0.0
            </div>
          </div>
        )}
      </div>
    </div>
  );
}