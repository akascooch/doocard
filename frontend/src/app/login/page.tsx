"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AppLogo } from "@/components/common/AppLogo"
import { PhoneOtpAuth } from "@/components/auth/PhoneOtpAuth"
import { login, isAuthenticated, getCurrentUser } from "@/lib/auth"
import { getErrorMessage } from "@/lib/error-handler"
import { resolveCustomerPostAuthHref } from "@/lib/booking-draft"
import Footer from "@/components/Footer"

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

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="flex-1 flex items-center justify-center relative z-10 rtl p-4">
        <Card className="w-full max-w-md shadow-2xl animate-fade-in-up bg-white/90 dark:bg-card/80 backdrop-blur-xl">
          <CardHeader className="space-y-4 text-center flex flex-col items-center">
            <div className="flex justify-center mb-2 pt-6">
              <AppLogo size="md" centered animated />
            </div>
            <CardTitle className="text-3xl">
              {staffMode ? "ورود کارکنان" : intent === "register" ? "ثبت‌نام / ورود" : "ورود"}
            </CardTitle>
            <CardDescription>
              {staffMode
                ? "ورود با ایمیل یا موبایل و رمز عبور مخصوص کارکنان و مدیریت"
                : "مشتریان فقط با شماره موبایل و کد پیامکی وارد می‌شوند"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {staffMode ? (
              <form onSubmit={handleStaffSubmit} className="space-y-5">
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

                <div className="flex items-center gap-2">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={formData.rememberMe}
                    onChange={(e) =>
                      setFormData({ ...formData, rememberMe: e.target.checked })
                    }
                  />
                  <Label htmlFor="rememberMe" className="text-sm font-normal">
                    مرا به خاطر بسپار (کارکنان، تا ۹۰ روز)
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full btn-doocard btn-doocard-lg mt-6"
                  disabled={loading}
                  style={{ color: "#111827", WebkitTextFillColor: "#111827" }}
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

            <div className="divider-doocard"></div>

            <div className="text-center space-y-2">
              {staffMode ? (
                <button
                  type="button"
                  className="text-sm font-semibold text-foreground hover:opacity-80"
                  onClick={() => setStaffMode(false)}
                >
                  ورود مشتریان با پیامک
                </button>
              ) : (
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => setStaffMode(true)}
                >
                  ورود کارکنان با رمز عبور
                </button>
              )}
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
