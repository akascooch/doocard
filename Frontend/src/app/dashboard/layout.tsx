"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "next-themes"
import { Header } from "@/components/header"
import { Icon } from "@/components/ui/icon"
import { Button } from "@/components/ui/button"
import Cookies from 'js-cookie'
import { getCurrentUser } from '@/lib/auth';

const menuItems = [
  {
    title: "داشبورد",
    icon: "LayoutDashboard",
    href: "/dashboard",
  },
  {
    title: "نوبت‌ها",
    icon: "Calendar",
    href: "/dashboard/appointments",
  },
  {
    title: "مشتریان",
    icon: "Users",
    href: "/dashboard/customers",
  },
  {
    title: "مدیریت کاربران",
    icon: "Users", // یا اگر آیکون دیگری داری مثل UserCog، جایگزین کن
    href: "/dashboard/admin/users",
  },
  {
    title: "کارکنان",
    icon: "User",
    href: "/dashboard/staff",
  },
  {
    title: "پیامک‌ها",
    icon: "MessageSquare",
    href: "/dashboard/sms",
  },
  {
    title: "خدمات",
    icon: "Scissors",
    href: "/dashboard/services",
  },
  {
    title: "حسابداری",
    icon: "DollarSign",
    href: "/dashboard/accounting",
  },
  {
    title: "تنظیمات",
    icon: "Settings",
    href: "/dashboard/settings",
  },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [salonName, setSalonName] = useState("")
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const [user, setUser] = useState<any>(null);

  const handleLogout = () => {
    // پاک کردن توکن از کوکی
    Cookies.remove('token')
    // پاک کردن اطلاعات کاربر از localStorage
    localStorage.removeItem('user')
    // ریدایرکت مطمئن به صفحه لاگین
    window.location.replace('/login')
  }

  useEffect(() => {
    setMounted(true)
    // Load salon name from localStorage
    const savedSalonName = localStorage.getItem('salonName')
    if (savedSalonName) {
      setSalonName(savedSalonName)
    }
    // دریافت کاربر لاگین شده
    const u = getCurrentUser();
    setUser(u);
    // اگر مشتری است و مسیر فعلی غیر از نوبت‌هاست، ریدایرکت کن
    if (u && u.role === 'CUSTOMER' && !pathname.startsWith('/dashboard/appointments')) {
      router.replace('/dashboard/appointments');
    }

    // Listen for salon name updates
    const handleSalonNameUpdate = (event: CustomEvent) => {
      setSalonName(event.detail)
    }

    window.addEventListener('salonNameUpdated', handleSalonNameUpdate as EventListener)

    // --- Idle Timeout Logic ---
    let idleTimeout: number | null = null
    const IDLE_LIMIT = 20 * 1000 // 20 ثانیه برای تست سریع

    const resetIdleTimer = () => {
      if (idleTimeout) window.clearTimeout(idleTimeout)
      idleTimeout = window.setTimeout(() => {
        handleLogout()
      }, IDLE_LIMIT)
    }

    // رویدادهای کاربر که تایمر را ریست می‌کنند
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(event => window.addEventListener(event, resetIdleTimer))
    resetIdleTimer()

    return () => {
      window.removeEventListener('salonNameUpdated', handleSalonNameUpdate as EventListener)
      events.forEach(event => window.removeEventListener(event, resetIdleTimer))
      if (idleTimeout) window.clearTimeout(idleTimeout)
    }
  }, [pathname, router])

  if (!mounted) {
    return null
  }

  // فیلتر آیتم‌های منو بر اساس نقش
  const filteredMenuItems = user && user.role === 'CUSTOMER'
    ? [
        {
          title: 'رزرو نوبت',
          icon: 'Calendar',
          href: '/dashboard/appointments',
        },
      ]
    : menuItems;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 z-40 h-screen transition-all duration-300 ${
          isSidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="flex h-full flex-col gap-4 border-l bg-card px-6 py-4">
          {/* Salon Name and Toggle Button */}
          <div className="flex items-center justify-between mb-6">
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-bold text-lg truncate"
                >
                  {salonName || "آرایشگاه"}
                </motion.div>
              )}
            </AnimatePresence>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Icon name={isSidebarOpen ? "X" : "Menu"} size={20} />
            </Button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-2">
            {filteredMenuItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <span
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground"
                    }`}
                  >
                    <Icon name={item.icon} size={20} />
                    <AnimatePresence>
                      {isSidebarOpen && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          className="whitespace-nowrap"
                        >
                          {item.title}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Icon name="Sun" size={20} /> : <Icon name="Moon" size={20} />}
              <AnimatePresence>
                {isSidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                  >
                    {theme === "dark" ? "حالت روشن" : "حالت تاریک"}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <Icon name="LogOut" size={20} />
              <AnimatePresence>
                {isSidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0, width: 0 }}
                  >
                    خروج
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`min-h-screen transition-all duration-300 ${isSidebarOpen ? "mr-64" : "mr-20"}`}>
        <Header />
        <div className="container py-6">
          {children}
        </div>
      </main>
    </div>
  )
} 