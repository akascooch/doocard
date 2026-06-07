"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Label } from "@/components/ui/label"
import { AppLogo } from "@/components/common/AppLogo"

import { login, isAuthenticated } from "@/lib/auth"
import { getErrorMessage } from "@/lib/error-handler"
import Footer from "@/components/Footer"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
  })

  // Check if user is already authenticated
  React.useEffect(() => {
    if (isAuthenticated()) {
      router.push('/dashboard')
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await login({
        identifier: formData.identifier,
        password: formData.password
      })
      
      if (result.user) {
        toast({
          title: 'ورود موفق',
          description: 'به سیستم مدیریت آرایشگاه خوش آمدید',
        })

        router.push('/dashboard')
      } else {
        throw new Error('ورود ناموفق')
      }
    } catch (error: any) {
      const errorMessage = getErrorMessage(error)
      
      toast({
        title: 'خطا در ورود',
        description: errorMessage,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Content */}
      <div className="flex-1 flex items-center justify-center relative z-10 rtl p-4">
        <Card
          className="w-full max-w-md shadow-2xl animate-fade-in-up bg-white/90 dark:bg-card/80 backdrop-blur-xl"
        >
          <CardHeader className="space-y-4 text-center flex flex-col items-center">
            <div className="flex justify-center mb-2 pt-6">
              <AppLogo size="md" centered animated />
            </div>
            <CardTitle className="text-3xl">خوش آمدید</CardTitle>
            <CardDescription>
              برای ورود به سیستم مدیریت آرایشگاه، لطفاً وارد شوید
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="identifier" className="label-doocard">ایمیل یا شماره موبایل</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="ایمیل یا شماره موبایل خود را وارد کنید"
                  value={formData.identifier}
                  onChange={(e) =>
                    setFormData({ ...formData, identifier: e.target.value })
                  }
                  className="input-doocard"
                />
                <p className="text-xs text-muted-foreground">
                  می‌توانید با ایمیل یا شماره موبایل وارد شوید
                </p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="password" className="label-doocard">رمز عبور</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  required
                  placeholder="رمز عبور خود را وارد کنید"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="input-doocard"
                />
              </div>
              
              <Button
                type="submit"
                className="w-full btn-doocard btn-doocard-lg mt-6"
                disabled={loading}
                style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
              >
                {loading ? (
                  <div className="flex items-center gap-2" style={{ color: '#111827', WebkitTextFillColor: '#111827' }}>
                    <div className="spinner-doocard !w-5 !h-5 !border-2"></div>
                    در حال ورود...
                  </div>
                ) : (
                  <span style={{ color: '#111827', WebkitTextFillColor: '#111827' }}>ورود به سیستم</span>
                )}
              </Button>
            </form>
            
            <div className="divider-doocard"></div>
            
            <div className="text-center">
              <span className="text-sm text-muted-foreground">حساب کاربری ندارید؟ </span>
              <button
                type="button"
                className="text-sm font-semibold text-foreground hover:opacity-80 transition-colors duration-300"
                onClick={() => router.push('/register')}
              >
                ثبت‌نام کنید
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  )
}
