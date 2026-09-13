"use client"

import { useEffect, useRef } from "react"
import type { ClipboardEvent, KeyboardEvent } from "react"
import { Label } from "@/components/ui/label"

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹"
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩"

function toAsciiDigits(raw: string): string {
  return String(raw || "")
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/\D/g, "")
}

type OtpInputProps = {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
  autoFocus?: boolean
  length?: number
  label?: string
  id?: string
}

/**
 * 5-box OTP input: auto-advance, paste, backspace, numeric keypad, WebOTP.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
  length = 5,
  label = "کد تأیید ۵ رقمی",
  id = "otp-code",
}: OtpInputProps) {
  const boxesRef = useRef<Array<HTMLInputElement | null>>([])
  const hiddenRef = useRef<HTMLInputElement>(null)
  const onChangeRef = useRef(onChange)
  const onCompleteRef = useRef(onComplete)
  const completedRef = useRef("")
  onChangeRef.current = onChange
  onCompleteRef.current = onComplete

  const apply = (nextRaw: string, focusIndex?: number) => {
    const next = toAsciiDigits(nextRaw).slice(0, length)
    onChangeRef.current(next)
    if (typeof focusIndex === "number") {
      const el = boxesRef.current[Math.max(0, Math.min(focusIndex, length - 1))]
      el?.focus()
      el?.select()
    }
    if (next.length === length) {
      if (completedRef.current !== next) {
        completedRef.current = next
        onCompleteRef.current?.(next)
      }
    } else {
      completedRef.current = ""
    }
  }

  useEffect(() => {
    if (autoFocus) {
      boxesRef.current[0]?.focus()
    }
  }, [autoFocus])

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
        if (code) apply(code, length - 1)
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timeout))

    return () => {
      abort.abort()
      window.clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- WebOTP listener is length-scoped
  }, [length])

  const chars = Array.from({ length }, (_, i) => value[i] ?? "")

  const handleChange = (index: number, raw: string) => {
    const digits = toAsciiDigits(raw)
    if (digits.length > 1) {
      apply(digits, Math.min(digits.length, length) - 1)
      return
    }
    const nextChars = chars.slice()
    nextChars[index] = digits
    const packed = nextChars.join("")
    apply(packed, digits ? Math.min(index + 1, length - 1) : index)
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault()
      if (chars[index]) {
        const nextChars = chars.slice()
        nextChars[index] = ""
        apply(nextChars.join(""), index)
      } else if (index > 0) {
        const nextChars = chars.slice()
        nextChars[index - 1] = ""
        apply(nextChars.join(""), index - 1)
      }
      return
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault()
      boxesRef.current[Math.max(0, index - 1)]?.focus()
    }
    if (event.key === "ArrowRight") {
      event.preventDefault()
      boxesRef.current[Math.min(length - 1, index + 1)]?.focus()
    }
  }

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const pasted = toAsciiDigits(event.clipboardData.getData("text"))
    if (!pasted) return
    const prefix = value.slice(0, index)
    apply(prefix + pasted, Math.min(prefix.length + pasted.length, length) - 1)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        ref={hiddenRef}
        id={id}
        name="one-time-code"
        autoComplete="one-time-code"
        inputMode="numeric"
        value={value}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <div dir="ltr" className="flex justify-center gap-2" role="group" aria-label={label}>
        {chars.map((digit, index) => (
          <input
            key={`${id}-${index}`}
            ref={(el) => {
              boxesRef.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={index === 0 ? length : 1}
            disabled={disabled}
            value={digit}
            aria-label={`رقم ${index + 1} از ${length}`}
            className="h-12 w-11 rounded-xl border border-border bg-background text-center text-lg font-semibold tracking-widest text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-14 sm:w-12"
            onChange={(event) => handleChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </div>
    </div>
  )
}
