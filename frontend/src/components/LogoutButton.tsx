'use client'

import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LogoutButtonProps {
  isCollapsed?: boolean
  isHovered?: boolean
  isMobile?: boolean
}

export function LogoutButton({ isCollapsed = false, isHovered = false, isMobile = false }: LogoutButtonProps) {
  const handleLogout = () => {
    // حذف توکن از localStorage
    localStorage.removeItem('token')
    // حذف توکن از cookies
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    // ریدایرکت به صفحه لاگین
    window.location.href = '/login'
  }

  const isVisible = !isCollapsed || isHovered || isMobile

  return (
    <button
      onClick={handleLogout}
      className={cn(
        'group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm font-extrabold bg-red-500 hover:bg-red-600 transition-all duration-200 hover:shadow-lg shadow-md',
        isCollapsed && !isHovered && !isMobile && 'justify-center px-2'
      )}
      title={isCollapsed && !isHovered && !isMobile ? 'خروج' : undefined}
    >
      <LogOut 
        className="h-6 w-6 flex-shrink-0 transition-all duration-200 group-hover:scale-110" 
        style={{ color: '#111827', stroke: '#111827' }} 
      />
      {isVisible && (
        <span 
          className="transition-all duration-200 font-extrabold" 
          style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
        >
          خروج
        </span>
      )}
    </button>
  )
}