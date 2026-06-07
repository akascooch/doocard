"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

export default function DashboardRedirect() {
  const router = useRouter()

  useEffect(() => {
    const currentUser = getCurrentUser()
    
    if (!currentUser) {
      // No auto-redirect to login; user stays on this transition page.
      return
    }

    // Redirect based on user role
    switch (currentUser.role) {
      case 'ADMIN':
        router.push('/dashboard/admin')
        break
      case 'EMPLOYEE':
        router.push('/dashboard/employee')
        break
      case 'CUSTOMER':
        router.push('/dashboard/customer')
        break
      default:
        router.push('/dashboard/customer')
    }
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