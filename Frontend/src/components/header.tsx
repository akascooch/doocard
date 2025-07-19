import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { NotificationsPanel } from "@/components/ui/notifications-panel"
import { UserMenu } from "@/components/ui/user-menu"
import { Notification, User } from "@/types"
import Cookies from 'js-cookie'

export function Header() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
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
    Cookies.remove('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  const handleMarkAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })))
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Icon name="Sun" size={20} /> : <Icon name="Moon" size={20} />}
          </Button>

          {/* Search */}
          <div className="relative hidden md:block">
            <div className="flex h-9 items-center gap-2 rounded-md border bg-background px-3 text-muted-foreground">
              <Icon name="Search" size={16} />
              <input
                type="text"
                placeholder="جستجو..."
                className="bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setShowNotifications(!showNotifications)}
            >
              <Icon name="Bell" size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </Button>

            {showNotifications && (
              <NotificationsPanel 
                notifications={notifications}
                onMarkAllAsRead={handleMarkAllAsRead}
              />
            )}
          </div>

          {/* User Menu */}
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </div>
      </div>
    </header>
  )
} 