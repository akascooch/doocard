'use client'

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { NotificationsPanel } from "@/components/ui/notifications-panel"
import { UserMenu } from "@/components/ui/user-menu"
import NotificationBell from "@/components/NotificationBell"

import { Notification, User } from "@/types"
import { 
  Bell, 
  Search, 
  Sun, 
  Moon, 
  Menu, 
  X,
  Sparkles,
  User as UserIcon,
  Settings,
} from 'lucide-react'
import { cn } from "@/lib/utils"

interface HeaderProps {
  onToggleSidebar?: () => void
  isSidebarOpen?: boolean
}

export function Header({ onToggleSidebar, isSidebarOpen }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      text: "نوبت جدید برای ساعت ۱۵:۰۰",
      time: "۱۰ دقیقه پیش",
      type: "appointment",
      isRead: false
    },
    {
      id: 2,
      text: "کنسلی نوبت آقای محمدی",
      time: "۳۰ دقیقه پیش",
      type: "cancellation",
      isRead: false
    },
    {
      id: 3,
      text: "یادآوری: نوبت آقای احمدی ساعت ۱۶:۳۰",
      time: "۱ ساعت پیش",
      type: "reminder",
      isRead: true
    },
    {
      id: 4,
      text: "بروزرسانی سیستم با موفقیت انجام شد",
      time: "۲ ساعت پیش",
      type: "system",
      isRead: true
    }
  ])

  const unreadCount = notifications.filter(n => !n.isRead).length

  useEffect(() => {
    setMounted(true)
    const userData = localStorage.getItem('user')
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      } catch (error) {
        console.error('Error parsing user data:', error)
        localStorage.removeItem('user')
      }
    }
  }, [])

  // Prevent hydration mismatch
  if (!mounted) {
    return null
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    router.push('/login')
  }

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })))
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-20 items-center justify-between px-6 lg:px-8">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="hidden md:flex items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
          </div>
          
          {/* Mobile Menu Button */}
          {onToggleSidebar && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleSidebar}
              className="lg:hidden rounded-xl hover:bg-accent/10"
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hidden sm:flex rounded-xl hover:bg-accent/10"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* Search - Desktop */}
          <div className="relative hidden md:block">
            <div className="flex h-12 items-center gap-3 rounded-xl border border-border bg-input px-4 text-muted-foreground shadow-sm transition-all duration-200 hover:shadow-md focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
              <Search className="h-4 w-4" />
              <input
                type="text"
                placeholder="جستجو در سیستم..."
                className="w-64 bg-transparent outline-none placeholder:text-muted-foreground text-sm font-medium"
              />
            </div>
          </div>

          {/* Search - Mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSearch(!showSearch)}
            className="md:hidden rounded-xl hover:bg-accent/10"
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          {/* Settings */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl hover:bg-accent/10"
          >
            <Settings className="h-5 w-5" />
          </Button>

          {/* Notifications - Real-time system */}
          <NotificationBell />

          {/* User Menu */}
          <UserMenu user={user} onLogout={handleLogout} />
        </div>
      </div>

      {/* Mobile Search Bar */}
      {showSearch && (
        <div className="border-t border-border bg-card/80 backdrop-blur-md p-4 md:hidden">
          <div className="flex h-12 items-center gap-3 rounded-xl border border-border bg-input px-4 shadow-sm transition-all duration-200 focus-within:shadow-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="جستجو در سیستم..."
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground text-sm font-medium"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  )
}