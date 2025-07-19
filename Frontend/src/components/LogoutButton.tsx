'use client'

import { useRouter } from 'next/navigation'
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline"
import { Button } from '@/components/ui/button'
import Cookies from 'js-cookie'

export function LogoutButton() {
  const router = useRouter()

  const handleLogout = () => {
    // پاک کردن توکن و اطلاعات کاربر
    Cookies.remove('token')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    
    // انتقال به صفحه لاگین
    router.push('/login')
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
      onClick={handleLogout}
    >
      <ArrowRightOnRectangleIcon className="ml-2 h-4 w-4" />
      <span>خروج</span>
    </Button>
  )
}