"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { login } from "@/lib/auth"
import { getErrorMessage } from "@/lib/error-handler"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await login(formData)
      
      toast({
        title: 'ورود موفق',
        description: 'به سیستم مدیریت آرایشگاه خوش آمدید',
      })

      router.push('/dashboard')
    } catch (error: any) {
      const errorMessage = getErrorMessage(error)
      
      toast({
        variant: 'destructive',
        title: 'خطا در ورود',
        description: errorMessage,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="Scissors" size={32} />
            </div>
          </div>
          <CardTitle className="text-2xl">خوش آمدید</CardTitle>
          <CardDescription>
            برای ورود به سیستم مدیریت آرایشگاه، لطفاً وارد شوید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                ایمیل
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="ایمیل خود را وارد کنید (مثال: admin@example.com)"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                رمز عبور
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="رمز عبور خود را وارد کنید"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'در حال ورود...' : 'ورود به سیستم'}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <span className="text-sm">حساب کاربری ندارید؟ </span>
            <button
              type="button"
              className="text-blue-600 hover:underline text-sm"
              onClick={() => router.push('/register')}
            >
              ثبت‌نام
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
