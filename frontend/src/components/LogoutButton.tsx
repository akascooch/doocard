'use client'

import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/lib/auth'

interface LogoutButtonProps {
  isCollapsed?: boolean
  isHovered?: boolean
  isMobile?: boolean
}

export function LogoutButton({ isCollapsed = false, isHovered = false, isMobile = false }: LogoutButtonProps) {
  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const isVisible = !isCollapsed || isHovered || isMobile

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={cn(
        'group flex w-full items-center gap-4 rounded-xl border border-transparent px-4 py-3 text-sm font-medium text-zinc-400 transition-all hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50',
        isCollapsed && !isHovered && !isMobile && 'justify-center px-2'
      )}
      title={isCollapsed && !isHovered && !isMobile ? 'خروج' : undefined}
    >
      <LogOut className="h-6 w-6 flex-shrink-0 transition-colors" />
      {isVisible && (
        <span className="font-medium transition-colors">
          خروج
        </span>
      )}
    </button>
  )
}
