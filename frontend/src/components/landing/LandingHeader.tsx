"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { AppLogo } from "@/components/common/AppLogo"

const NAV = [
  { href: "/#services", label: "خدمات" },
  { href: "/#team", label: "تیم دوکارد" },
  { href: "/products", label: "فروشگاه" },
  { href: "/#gallery", label: "گالری" },
  { href: "/#about", label: "درباره ما" },
  { href: "/#contact", label: "تماس" },
]

const tap =
  "touch-manipulation pointer-events-auto [-webkit-tap-highlight-color:transparent] select-none"

export function LandingHeader({ bookHref }: { bookHref: string }) {
  const [open, setOpen] = useState(false)

  return (
    <header
      className="fixed inset-x-0 top-0 z-[100] border-b border-border bg-card/95 text-card-foreground backdrop-blur-xl"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}
    >
      <div className="mx-auto flex min-h-11 max-w-7xl items-center justify-between gap-2 px-3 sm:min-h-16 sm:gap-3 sm:px-6 lg:px-8">
        <Link href="/" className={`${tap} flex min-h-11 min-w-0 items-center gap-2 sm:gap-3`}>
          <div className="relative h-9 w-9 shrink-0 overflow-hidden sm:h-11 sm:w-11">
            <AppLogo size="sm" animated={false} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[0.18em] text-card-foreground sm:text-base">
              DOOCARD
            </p>
            <p className="hidden truncate text-[10px] tracking-[0.28em] text-card-foreground sm:block">
              BARBERSHOP
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-card-foreground lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`${tap} transition-colors hover:text-accent-foreground`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="relative z-[101] flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className={`${tap} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-xs text-card-foreground hover:bg-accent sm:px-4 sm:text-sm`}
          >
            ورود
          </Link>
          <Link
            href="/login?intent=register"
            className={`${tap} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-xs text-card-foreground hover:bg-accent sm:px-4 sm:text-sm`}
          >
            ثبت‌نام
          </Link>
          <Link
            href={bookHref}
            /* [GATED-W-B] Brand primary CTA — Wave B product decision (AUDIT_GLASS_CONVERSION_20260922). */
            className={`${tap} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:px-4 sm:text-sm`}
          >
            <span className="sm:hidden">رزرو</span>
            <span className="hidden sm:inline">رزرو آنلاین</span>
          </Link>
          <button
            type="button"
            className={`${tap} inline-flex h-11 w-11 items-center justify-center rounded-md border border-border text-card-foreground lg:hidden`}
            aria-label={open ? "بستن منو" : "باز کردن منو"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`border-t border-border bg-card transition-[max-height,opacity] duration-300 lg:hidden ${
          open
            ? "pointer-events-auto max-h-[min(80vh,32rem)] overflow-y-auto opacity-100"
            : "pointer-events-none max-h-0 overflow-hidden opacity-0"
        }`}
        style={{ paddingBottom: open ? "max(1rem, env(safe-area-inset-bottom, 0px))" : 0 }}
      >
        <nav className="flex flex-col gap-1 px-4 py-4 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${tap} min-h-11 rounded-md px-3 py-3 text-card-foreground hover:bg-accent`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className={`${tap} flex min-h-11 items-center rounded-md px-3 py-3 text-card-foreground hover:bg-accent`}
            onClick={() => setOpen(false)}
          >
            ورود
          </Link>
          <Link
            href="/login?intent=register"
            className={`${tap} flex min-h-11 items-center rounded-md px-3 py-3 text-card-foreground hover:bg-accent`}
            onClick={() => setOpen(false)}
          >
            ثبت‌نام
          </Link>
          <Link
            href={bookHref}
            /* [GATED-W-B] Brand primary CTA — Wave B product decision */
            className={`${tap} flex min-h-11 items-center justify-center rounded-md bg-primary px-3 py-3 text-center font-semibold text-primary-foreground`}
            onClick={() => setOpen(false)}
          >
            رزرو آنلاین نوبت
          </Link>
        </nav>
      </div>
    </header>
  )
}
