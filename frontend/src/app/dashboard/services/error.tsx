'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '../../../components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Services page error:', error)
  }, [error])

  const goToDashboard = () => {
    router.push('/dashboard')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="text-6xl">🚨</div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        مشکلی پیش آمده است
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
        {error.message || 'خطایی در بارگذاری صفحه خدمات رخ داده است'}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>
          تلاش مجدد
        </Button>
        <Button variant="outline" onClick={goToDashboard}>
          بازگشت به داشبورد
        </Button>
      </div>
    </div>
  )
}
