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
      className="fixed inset-x-0 top-0 z-[100] border-b border-white/10 bg-black/80 backdrop-blur-xl"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}
    >
      <div className="mx-auto flex min-h-11 max-w-7xl items-center justify-between gap-2 px-3 sm:min-h-16 sm:gap-3 sm:px-6 lg:px-8">
        <Link href="/" className={`${tap} flex min-h-11 min-w-0 items-center gap-2 sm:gap-3`}>
          <div className="relative h-9 w-9 shrink-0 overflow-hidden sm:h-11 sm:w-11">
            <AppLogo size="sm" animated={false} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-[0.18em] text-white sm:text-base">
              DOOCARD
            </p>
            <p className="hidden truncate text-[10px] tracking-[0.28em] text-zinc-400 sm:block">
              BARBERSHOP
            </p>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-zinc-300 lg:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`${tap} transition-colors hover:text-white`}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="relative z-[101] flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className={`${tap} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/20 px-3 text-xs text-white hover:bg-white/10 sm:px-4 sm:text-sm`}
          >
            ورود
          </Link>
          <Link
            href="/register"
            className={`${tap} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/20 px-3 text-xs text-white hover:bg-white/10 sm:px-4 sm:text-sm`}
          >
            ثبت‌نام
          </Link>
          <Link
            href={bookHref}
            className={`${tap} inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-white px-3 text-xs font-semibold text-black hover:bg-zinc-200 sm:px-4 sm:text-sm`}
          >
            <span className="sm:hidden">رزرو</span>
            <span className="hidden sm:inline">رزرو آنلاین</span>
          </Link>
          <button
            type="button"
            className={`${tap} inline-flex h-11 w-11 items-center justify-center rounded-md border border-white/20 text-white lg:hidden`}
            aria-label={open ? "بستن منو" : "باز کردن منو"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`border-t border-white/10 bg-black transition-[max-height,opacity] duration-300 lg:hidden ${
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
              className={`${tap} min-h-11 rounded-md px-3 py-3 text-zinc-200 hover:bg-white/5`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className={`${tap} flex min-h-11 items-center rounded-md px-3 py-3 text-zinc-200 hover:bg-white/5`}
            onClick={() => setOpen(false)}
          >
            ورود
          </Link>
          <Link
            href="/register"
            className={`${tap} flex min-h-11 items-center rounded-md px-3 py-3 text-zinc-200 hover:bg-white/5`}
            onClick={() => setOpen(false)}
          >
            ثبت‌نام
          </Link>
          <Link
            href={bookHref}
            className={`${tap} flex min-h-11 items-center justify-center rounded-md bg-white px-3 py-3 text-center font-semibold text-black`}
            onClick={() => setOpen(false)}
          >
            رزرو آنلاین نوبت
          </Link>
        </nav>
      </div>
    </header>
  )
}
