'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Legacy insecure SMS page (/dashboard/sms) — neutralized.
 * Redirects to the secure ADMIN panel. Do not restore API-key UI.
 */
export default function LegacySmsRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard/admin/sms')
  }, [router])

  return (
    <div className="p-6 text-sm text-muted-foreground" dir="rtl">
      در حال انتقال به پنل امن پیامک…
    </div>
  )
}
