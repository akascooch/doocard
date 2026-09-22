"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OtpInput } from "@/components/auth/OtpInput"
import { useToast } from "@/components/ui/use-toast"
import { persistAuthSession } from "@/lib/auth"
import { getErrorMessage } from "@/lib/error-handler"
import { normalizeIranMobileClient } from "@/components/customers/QuickRegisterCustomerForm"
import api from "@/lib/axios"

const IRAN_MOBILE_RE = /^09\d{9}$/
const OTP_LENGTH = 5

export type OtpAuthResult = {
  user: {
    id: number
    name?: string | null
    phone?: string | null
    role?: string
  }
  isNewUser: boolean
  access_token?: string
}

type PhoneOtpAuthProps = {
  purpose?: "LOGIN" | "BOOKING"
  intent?: "login" | "register"
  initialPhone?: string
  onAuthenticated: (result: OtpAuthResult) => void
}

function otpErrorDescription(error: unknown, fallback: string): string {
  const err = error as { response?: { status?: number; data?: { message?: string | string[] } } }
  const status = err?.response?.status
  const raw = err?.response?.data?.message
  const backend = Array.isArray(raw) ? raw[0] : raw
  if (status === 400) return backend || "شماره موبایل یا کد نامعتبر است."
  if (status === 429) return backend || "تعداد درخواست کد بیش از حد مجاز است. کمی بعد تلاش کنید."
  if (status === 503) return backend || "سرویس ارسال پیامک در دسترس نیست. لطفاً بعداً تلاش کنید."
  return getErrorMessage(error as Parameters<typeof getErrorMessage>[0]) || fallback
}

export function PhoneOtpAuth({
  purpose = "LOGIN",
  intent = "login",
  initialPhone = "",
  onAuthenticated,
}: PhoneOtpAuthProps) {
  const { toast } = useToast()
  const [phone, setPhone] = useState(initialPhone)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [pendingNewUser, setPendingNewUser] = useState<OtpAuthResult | null>(null)
  const verifyLock = useRef(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setInterval(() => {
      setCooldown((s) => (s <= 1 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldown])

  const sendCode = async () => {
    const normalized = normalizeIranMobileClient(phone)
    if (!IRAN_MOBILE_RE.test(normalized)) {
      toast({ title: "خطا", description: "شماره موبایل معتبر نیست", variant: "destructive" })
      return
    }
    setSending(true)
    try {
      const response = await api.post("/auth/otp/send", { phone: normalized, purpose })
      setPhone(normalized)
      setOtpSent(true)
      setCode("")
      const expires = Number(response.data?.expiresInSeconds)
      setCooldown(Number.isFinite(expires) ? Math.min(Math.max(expires, 60), 120) : 120)
      toast({ title: "کد ارسال شد", description: "کد ۵ رقمی پیامک‌شده را وارد کنید." })
    } catch (error) {
      toast({
        title: "ارسال کد ناموفق",
        description: otpErrorDescription(error, "ارسال کد ناموفق بود"),
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  const finish = (result: OtpAuthResult) => {
    persistAuthSession(result)
    onAuthenticated(result)
  }

  const verifyCode = async (nextCode?: string) => {
    const digits = (nextCode ?? code).replace(/\D/g, "").slice(0, OTP_LENGTH)
    if (digits.length !== OTP_LENGTH || verifyLock.current) return
    verifyLock.current = true
    setVerifying(true)
    try {
      const response = await api.post("/auth/otp/verify", {
        phone: normalizeIranMobileClient(phone),
        code: digits,
        purpose,
      })
      const result: OtpAuthResult = {
        user: response.data.user,
        isNewUser: Boolean(response.data.isNewUser),
        access_token: response.data.access_token,
      }
      persistAuthSession(result)
      if (result.isNewUser) {
        setPendingNewUser(result)
        return
      }
      toast({ title: "ورود موفق", description: "با موفقیت وارد شدید." })
      finish(result)
    } catch (error) {
      toast({
        title: "تأیید ناموفق",
        description: otpErrorDescription(error, "کد تأیید نادرست است"),
        variant: "destructive",
      })
    } finally {
      verifyLock.current = false
      setVerifying(false)
    }
  }

  const saveNameAndFinish = async () => {
    if (!pendingNewUser) return
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      toast({ title: "خطا", description: "نام و نام خانوادگی را وارد کنید", variant: "destructive" })
      return
    }
    setSavingName(true)
    try {
      const response = await api.patch("/auth/me/name", { name: trimmed })
      const updated = {
        ...pendingNewUser,
        user: { ...pendingNewUser.user, ...response.data },
      }
      persistAuthSession(updated)
      toast({ title: "ثبت‌نام کامل شد", description: "حساب شما ساخته شد." })
      finish(updated)
    } catch (error) {
      toast({
        title: "ذخیره نام ناموفق",
        description: otpErrorDescription(error, "ذخیره نام ناموفق بود"),
        variant: "destructive",
      })
    } finally {
      setSavingName(false)
    }
  }

  if (pendingNewUser) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground">
          شماره شما تأیید شد. برای تکمیل حساب، نام خود را وارد کنید.
        </p>
        <div className="space-y-2">
          <Label htmlFor="otp-full-name">نام و نام خانوادگی</Label>
          <Input
            id="otp-full-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثلاً علی رضایی"
          />
        </div>
        <Button
          type="button"
          // [GATED-W-B] Auth OTP CTA inherits Button default (solid white in dark) — Wave B product decision.
          className="h-auto min-h-11 w-full"
          disabled={savingName || name.trim().length < 2}
          onClick={() => void saveNameAndFinish()}
        >
          {savingName ? "در حال ذخیره..." : "ادامه"}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {intent === "register"
          ? "با شماره موبایل ثبت‌نام کنید. کد ۵ رقمی پیامک می‌شود."
          : "با شماره موبایل وارد شوید. کد ۵ رقمی پیامک می‌شود."}
      </p>
      <div className="space-y-2">
        <Label htmlFor="otp-phone">شماره موبایل</Label>
          <Input
            id="otp-phone"
            dir="ltr"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="09123456789"
            className="min-h-11"
            value={phone}
            disabled={otpSent}
            onChange={(e) => setPhone(e.target.value)}
          />
      </div>
      {otpSent ? (
        <>
          <OtpInput
            value={code}
            onChange={setCode}
            onComplete={(next) => void verifyCode(next)}
            autoFocus
            disabled={verifying}
          />
          <Button
            type="button"
            // [GATED-W-B] Auth OTP CTA — Wave B product decision (AUDIT_GLASS_CONVERSION_20260922).
            className="h-auto min-h-11 w-full"
            disabled={verifying || code.length !== OTP_LENGTH}
            onClick={() => void verifyCode()}
          >
            {verifying ? "در حال تأیید..." : "تأیید و ورود"}
          </Button>
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              className="text-muted-foreground underline-offset-4 hover:underline disabled:no-underline disabled:opacity-50"
              disabled={sending || cooldown > 0}
              onClick={() => void sendCode()}
            >
              {cooldown > 0 ? `ارسال مجدد (${cooldown} ثانیه)` : "ارسال مجدد کد"}
            </button>
            <button
              type="button"
              className="text-muted-foreground underline-offset-4 hover:underline"
              onClick={() => {
                setOtpSent(false)
                setCode("")
                setCooldown(0)
                verifyLock.current = false
              }}
            >
              تغییر شماره
            </button>
          </div>
        </>
      ) : (
        <Button
          type="button"
          // [GATED-W-B] Auth send-code CTA — Wave B product decision.
          className="h-auto min-h-11 w-full"
          disabled={sending}
          onClick={() => void sendCode()}
        >
          {sending ? "در حال ارسال..." : "ارسال کد تأیید"}
        </Button>
      )}
    </div>
  )
}
