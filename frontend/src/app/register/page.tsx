"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { PhoneOtpAuth } from "@/components/auth/PhoneOtpAuth"
import { AuthSplitShell } from "@/components/auth/AuthSplitShell"
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
    <AuthSplitShell
      title="ثبت‌نام با موبایل"
      subtitle="بدون ایمیل و رمز عبور — فقط شماره موبایل و کد ۵ رقمی پیامک"
      heading="به دوکارد بپیوندید"
      headingHint="با شماره موبایل و کد ۵ رقمی پیامک حساب مشتری را فعال کنید."
      activeStep={1}
    >
      <Card
        padding="none"
        className="w-full rounded-3xl border border-zinc-800/80 bg-zinc-900/70 p-5 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-8"
      >
        <CardContent className="p-0 pt-0">
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
              className="aurora-auth-ghost flex w-full items-center justify-center py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
              onClick={() => router.push("/login")}
            >
              حساب دارید؟ وارد شوید
            </button>
          </div>
        </CardContent>
      </Card>
    </AuthSplitShell>
  )
}
