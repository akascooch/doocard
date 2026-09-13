"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { canAccessAdminDashboard, getDashboardHomePath } from "@/lib/user-roles"

export function AdminRoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    const user = getCurrentUser()
    if (!user) {
      window.location.replace("/login")
      return
    }
    if (!canAccessAdminDashboard(user.role)) {
      window.location.replace(getDashboardHomePath(user.role))
      return
    }
    if (pathname?.includes("/personal-expenses") && user.role !== "ADMIN") {
      window.location.replace(getDashboardHomePath(user.role))
      return
    }
    setAllowed(true)
  }, [pathname])

  if (!allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        در حال بررسی دسترسی...
      </div>
    )
  }

  return <>{children}</>
}
