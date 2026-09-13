"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AppLogo } from "@/components/common/AppLogo"
import { PhoneOtpAuth } from "@/components/auth/PhoneOtpAuth"
import Footer from "@/components/Footer"
import { isAuthenticated, getCurrentUser } from "@/lib/auth"
import { resolveCustomerPostAuthHref } from "@/lib/booking-draft"

export default function RegisterPage() {
  const router = useRouter()

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace(resolveCustomerPostAuthHref(getCurrentUser()?.role))
    }
  }, [router])

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="flex-1 flex items-center justify-center relative z-10 rtl p-4">
        <Card className="w-full max-w-md shadow-2xl bg-white/90 dark:bg-card/80 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center flex flex-col items-center">
            <div className="flex justify-center mb-2 pt-6">
              <AppLogo size="md" centered animated />
            </div>
            <CardTitle className="text-3xl">ثبت‌نام با موبایل</CardTitle>
            <CardDescription>
              بدون ایمیل و رمز عبور — فقط شماره موبایل و کد ۵ رقمی پیامک
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PhoneOtpAuth
              purpose="LOGIN"
              intent="register"
              onAuthenticated={(result) => {
                router.push(resolveCustomerPostAuthHref(result.user?.role))
              }}
            />
            <div className="mt-6 text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground"
                onClick={() => router.push("/login")}
              >
                حساب دارید؟ وارد شوید
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
