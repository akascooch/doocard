"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { PhoneOtpAuth } from "@/components/auth/PhoneOtpAuth"
import { AuthSplitShell } from "@/components/auth/AuthSplitShell"
import { login, isAuthenticated, getCurrentUser } from "@/lib/auth"
import { getErrorMessage } from "@/lib/error-handler"
import { resolveCustomerPostAuthHref } from "@/lib/booking-draft"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [staffMode, setStaffMode] = useState(false)
  const [intent, setIntent] = useState<"login" | "register">("login")
  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
    rememberMe: false,
  })

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    setStaffMode(query.get("staff") === "1")
    setIntent(query.get("intent") === "register" ? "register" : "login")
    if (isAuthenticated()) {
      router.replace(resolveCustomerPostAuthHref(getCurrentUser()?.role))
    }
  }, [router])

  const goAfterAuth = (role?: string | null) => {
    router.push(resolveCustomerPostAuthHref(role))
  }

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await login({
        identifier: formData.identifier,
        password: formData.password,
        rememberMe: formData.rememberMe,
      })

      if (result.user) {
        toast({
          title: "ورود موفق",
          description: "به سیستم مدیریت آرایشگاه خوش آمدید",
        })
        goAfterAuth(result.user.role)
      } else {
        throw new Error("ورود ناموفق")
      }
    } catch (error: unknown) {
      toast({
        title: "خطا در ورود",
        description: getErrorMessage(error as Parameters<typeof getErrorMessage>[0]),
      })
    } finally {
      setLoading(false)
    }
  }

  const title = staffMode ? "ورود کارکنان" : intent === "register" ? "ثبت‌نام / ورود" : "ورود"
  const subtitle = staffMode
    ? "ورود با ایمیل یا موبایل و رمز عبور مخصوص کارکنان و مدیریت"
    : "مشتریان فقط با شماره موبایل و کد پیامکی وارد می‌شوند"

  return (
    <AuthSplitShell
      title={title}
      subtitle={subtitle}
      heading={intent === "register" ? "به دوکارد بپیوندید" : "ورود به دوکارد"}
      headingHint="با شماره موبایل و کد پیامک وارد فضای سالن شوید."
      activeStep={1}
    >
      <Card
        padding="none"
        className="w-full rounded-3xl border border-zinc-800/80 bg-zinc-900/70 p-5 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:p-8"
      >
        <CardContent className="space-y-5 p-0 sm:space-y-6">
          {staffMode ? (
            <form onSubmit={handleStaffSubmit} className="space-y-5" dir="rtl">
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-sm font-medium leading-relaxed text-zinc-200">ایمیل یا شماره موبایل</Label>
                <Input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  required
                  dir="rtl"
                  placeholder="ایمیل یا شماره موبایل خود را وارد کنید"
                  value={formData.identifier}
                  onChange={(e) =>
                    setFormData({ ...formData, identifier: e.target.value })
                  }
                  className="min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-right text-white outline-none placeholder:text-zinc-500 transition-all duration-200 hover:border-zinc-700 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium leading-relaxed text-zinc-200">رمز عبور</Label>
                <PasswordInput
                  id="password"
                  autoComplete="current-password"
                  required
                  dir="rtl"
                  placeholder="رمز عبور خود را وارد کنید"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="min-h-11 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-right text-white outline-none placeholder:text-zinc-500 transition-all duration-200 hover:border-zinc-700 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              <div className="flex items-center gap-2.5">
                <input
                  id="rememberMe"
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded-md border border-zinc-700 bg-zinc-900 accent-white"
                  checked={formData.rememberMe}
                  onChange={(e) =>
                    setFormData({ ...formData, rememberMe: e.currentTarget.checked })
                  }
                />
                <Label htmlFor="rememberMe" className="select-none text-xs font-normal text-zinc-300 sm:text-sm">
                  مرا به خاطر بسپار (کارکنان، تا ۹۰ روز)
                </Label>
              </div>

              <Button
                type="submit"
                className="mt-4 h-auto min-h-11 w-full rounded-xl bg-white px-6 py-3.5 font-semibold text-black shadow-lg transition-all duration-200 hover:bg-zinc-200 hover:shadow-white/10 active:scale-[0.99]"
                disabled={loading}
              >
                {loading ? "در حال ورود..." : "ورود به سیستم"}
              </Button>
            </form>
          ) : (
            <PhoneOtpAuth
              purpose="LOGIN"
              intent={intent}
              onAuthenticated={(result) => goAfterAuth(result.user?.role)}
            />
          )}

          <div className="h-px w-full bg-zinc-800" />

          <div className="space-y-2 text-center">
            {staffMode ? (
              <button
                type="button"
                className="aurora-auth-ghost flex w-full items-center justify-center py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                onClick={() => setStaffMode(false)}
              >
                ورود مشتریان با پیامک
              </button>
            ) : (
              <button
                type="button"
                className="aurora-auth-ghost flex w-full items-center justify-center py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
                onClick={() => setStaffMode(true)}
              >
                ورود کارکنان با رمز عبور
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </AuthSplitShell>
  )
}
