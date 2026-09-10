"use client"

import { useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type OtpInputProps = {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  length?: number
  label?: string
  id?: string
}

/**
 * Single-field OTP input with WebOTP + autocomplete="one-time-code".
 * One field (not split boxes) is more reliable for SMS autofill.
 */
export function OtpInput({
  value,
  onChange,
  disabled,
  autoFocus,
  length = 5,
  label = "کد تأیید",
  id = "otp-code",
}: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("OTPCredential" in window) || !navigator.credentials?.get) return

    const abort = new AbortController()
    const timeout = window.setTimeout(() => abort.abort(), 2 * 60 * 1000)

    navigator.credentials
      .get({
        otp: { transport: ["sms"] },
        signal: abort.signal,
      } as CredentialRequestOptions)
      .then((credential) => {
        const code = (credential as { code?: string } | null)?.code
        if (code) onChangeRef.current(code.replace(/\D/g, "").slice(0, length))
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timeout))

    return () => {
      abort.abort()
      window.clearTimeout(timeout)
    }
  }, [length])

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        ref={inputRef}
        id={id}
        name="one-time-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={length}
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        dir="ltr"
        className="text-center text-lg tracking-[0.4em]"
        placeholder={"•".repeat(length)}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, length))}
      />
    </div>
  )
}
