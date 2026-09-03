"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getDashboardHomePath } from '@/lib/user-roles'

export default function DashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    const currentUser = getCurrentUser()

    if (!currentUser) {
      router.replace('/login')
      return
    }

    router.replace(getDashboardHomePath(currentUser.role))
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">در حال انتقال به داشبورد...</p>
      </div>
    </div>
  )
}
