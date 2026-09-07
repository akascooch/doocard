"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { AppLogo } from "@/components/common/AppLogo"

const NAV = [
  { href: "#services", label: "خدمات" },
  { href: "#team", label: "تیم دوکارد" },
  { href: "#gallery", label: "گالری" },
  { href: "#about", label: "درباره ما" },
  { href: "#contact", label: "تماس" },
]

export function LandingHeader({ bookHref }: { bookHref: string }) {
  const [open, setOpen] = useState(false)

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link href="#home" className="flex min-w-0 items-center gap-3">
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
            <a key={item.href} href={item.href} className="transition-colors hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/login"
            className="rounded-md border border-white/20 px-2 py-2 text-[11px] text-white hover:bg-white/10 sm:px-4 sm:text-sm"
          >
            ورود
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-white/20 px-2 py-2 text-[11px] text-white hover:bg-white/10 sm:px-4 sm:text-sm"
          >
            ثبت‌نام
          </Link>
          <Link
            href={bookHref}
            className="rounded-md bg-white px-2 py-2 text-[11px] font-semibold text-black hover:bg-zinc-200 sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">رزرو</span>
            <span className="hidden sm:inline">رزرو آنلاین</span>
          </Link>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-white lg:hidden"
            aria-label={open ? "بستن منو" : "باز کردن منو"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-t border-white/10 bg-black transition-[max-height,opacity] duration-300 lg:hidden ${
          open ? "max-h-[80vh] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-4 py-4 text-sm">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-3 text-zinc-200 hover:bg-white/5"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link
            href="/login"
            className="rounded-md px-3 py-3 text-zinc-200 hover:bg-white/5"
            onClick={() => setOpen(false)}
          >
            ورود
          </Link>
          <Link
            href="/register"
            className="rounded-md px-3 py-3 text-zinc-200 hover:bg-white/5"
            onClick={() => setOpen(false)}
          >
            ثبت‌نام
          </Link>
          <Link
            href={bookHref}
            className="rounded-md bg-white px-3 py-3 text-center font-semibold text-black"
            onClick={() => setOpen(false)}
          >
            رزرو آنلاین نوبت
          </Link>
        </nav>
      </div>
    </header>
  )
}
