"use client"

import "./homepage-background.css"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUp, Calendar, Clock, Instagram, MapPin, Phone, Shield, Sparkles } from "lucide-react"
import { initializeRouterStateCleanup } from "@/lib/clearRouterState"
import { initializeCacheClearing } from "@/lib/clearBrowserCache"
import { LandingHeader } from "@/components/landing/LandingHeader"
import { LandingCarousel } from "@/components/landing/LandingCarousel"
import { LandingMap } from "@/components/landing/LandingMap"
import {
  instagramHref,
  landingBookHref,
  parseWorkingHours,
  phoneToTel,
  readAuthToken,
  type LandingPublicData,
} from "@/lib/landing"

interface Service {
  id: number
  name: string
  description?: string
  durationMinutes?: number
}

function formatDuration(minutes?: number) {
  if (!minutes || Number.isNaN(minutes)) return "مدت زمان نامشخص"
  return `${minutes} دقیقه`
}

const FALLBACK: LandingPublicData = {
  heroTitle: "DOOCARD BARBERSHOP",
  heroSubtitle: "PRECISION IN EVERY DETAIL",
  aboutText:
    "در قلب تهران، فضایی خصوصی و آرام برای آقایانی که به جزئیات، سکوت و دقت اهمیت می‌دهند.",
  contact: "تیم دوکارد آماده پاسخ‌گویی به سوالات شما درباره خدمات و نوبت‌ها است.",
  phone: "021-26353460",
  address: "تهران، فرشته، مجتمع سام، طبقه ۵، واحد ۱۰۳",
  instagramUrl: "https://www.instagram.com/doocard",
  workingHours: JSON.stringify({
    weekdays: "۱۰:۰۰ – ۲۲:۰۰",
    friday: "۱۱:۰۰ – ۲۰:۰۰",
    note: "هماهنگی از طریق رزرو آنلاین",
  }),
  slides: [],
  staff: [],
}

export default function HomePage() {
  const [landing, setLanding] = useState<LandingPublicData>(FALLBACK)
  const [detailsLoading, setDetailsLoading] = useState(true)
  const [bookHref, setBookHref] = useState("/register")
  const [hasToken, setHasToken] = useState(false)

  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState<string | null>(null)

  useEffect(() => {
    initializeCacheClearing()
    initializeRouterStateCleanup()
    const token = Boolean(readAuthToken())
    setHasToken(token)
    setBookHref(landingBookHref(token))

    fetch("/api/homepage/public-data")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("homepage"))))
      .then((data: LandingPublicData) => {
        setLanding({ ...FALLBACK, ...data, slides: data.slides || [], staff: data.staff || [] })
      })
      .catch((error) => {
        console.error("Error fetching landing public data:", error)
      })
      .finally(() => setDetailsLoading(false))
  }, [])

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setServicesLoading(true)
        setServicesError(null)
        const res = await fetch("/api/services/public")
        if (!res.ok) throw new Error("خطا در دریافت خدمات")
        const data = await res.json()
        setServices(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error("Error fetching public services:", error)
        setServicesError("در بارگذاری خدمات مشکلی پیش آمد. لطفاً بعداً دوباره تلاش کنید.")
        setServices([])
      } finally {
        setServicesLoading(false)
      }
    }
    fetchServices()
  }, [])

  const hours = useMemo(() => parseWorkingHours(landing.workingHours), [landing.workingHours])
  const ig = instagramHref(landing.instagramUrl)
  const tel = phoneToTel(landing.phone)
  const heroImage = landing.slides[0]?.imageUrl

  return (
    <div className="min-h-screen scroll-smooth bg-black text-white">
      <LandingHeader bookHref={bookHref} />

      <main className="pt-[calc(4.75rem+env(safe-area-inset-top,0px))] sm:pt-[calc(6rem+env(safe-area-inset-top,0px))]">
        <section id="home" className="relative min-h-[88vh] overflow-hidden">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-35"
              fetchPriority="high"
            />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-[#080808]" />
          <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-5xl flex-col items-center justify-center px-4 py-20 text-center">
            <p className="mb-6 text-[11px] tracking-[0.42em] text-zinc-400">
              {detailsLoading ? "…" : landing.heroSubtitle || "PRECISION IN EVERY DETAIL"}
            </p>
            <h1 className="text-4xl font-semibold tracking-[0.12em] text-white sm:text-6xl md:text-7xl">
              {landing.heroTitle || "DOOCARD BARBERSHOP"}
            </h1>
            <p className="mt-8 max-w-2xl text-sm leading-8 text-zinc-400 sm:text-base">
              {detailsLoading
                ? "در حال آماده‌سازی تجربه‌ی شما..."
                : landing.aboutText || FALLBACK.aboutText}
            </p>
            <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              <Link
                href={bookHref}
                className="inline-flex items-center justify-center rounded-md bg-white px-8 py-3.5 text-sm font-semibold text-black hover:bg-zinc-200"
              >
                <Calendar className="ml-2 h-4 w-4" />
                رزرو آنلاین نوبت
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center rounded-md border border-white/20 px-8 py-3.5 text-sm text-white hover:bg-white/10"
              >
                مشاهده خدمات
              </a>
            </div>
          </div>
        </section>

        <section id="gallery" className="bg-[#080808] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="mb-3 text-xs tracking-[0.35em] text-zinc-500">گالری</p>
            <h2 className="mb-10 text-3xl font-semibold tracking-wide sm:text-4xl">فضا و جزئیات</h2>
            <LandingCarousel slides={landing.slides} />
          </div>
        </section>

        <section id="services" className="bg-black px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="mb-3 text-center text-xs tracking-[0.35em] text-zinc-500">خدمات</p>
            <h2 className="mb-4 text-center text-3xl font-semibold sm:text-4xl">خدمات تخصصی دوکارد</h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-sm text-zinc-400">
              هر خدمت با دقت و زمان مشخص ارائه می‌شود.
            </p>
            {servicesError && <p className="mb-8 text-center text-sm text-red-400">{servicesError}</p>}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {servicesLoading && services.length === 0 &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-[#080808]" />
                ))}
              {services.map((service) => (
                <article
                  key={service.id}
                  className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-[#080808] px-6 py-6"
                >
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[11px] text-zinc-400">
                      <Sparkles className="h-3 w-3" />
                      خدمت تخصصی
                    </div>
                    <h3 className="text-xl font-semibold">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm leading-7 text-zinc-400">{service.description}</p>
                    )}
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm">
                    <span className="text-zinc-400">{formatDuration(service.durationMinutes)}</span>
                    <Link
                      href={bookHref}
                      className="inline-flex min-h-11 items-center rounded-md bg-white px-4 text-xs font-semibold text-black touch-manipulation hover:bg-zinc-200"
                    >
                      رزرو
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="team" className="bg-[#080808] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="mb-3 text-xs tracking-[0.35em] text-zinc-500">تیم دوکارد</p>
            <h2 className="mb-10 text-3xl font-semibold sm:text-4xl">آرایشگران ارشد</h2>
            {landing.staff.length === 0 ? (
              <p className="text-sm text-zinc-500">اعضای تیم به‌زودی از پنل مدیریت معرفی می‌شوند.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {landing.staff.map((barber) => (
                  <article key={barber.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#141414]">
                    <div className="aspect-[4/5] bg-black">
                      {barber.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={barber.avatarUrl}
                          alt={barber.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-600">بدون تصویر</div>
                      )}
                    </div>
                    <div className="space-y-3 p-5">
                      <p className="text-[11px] tracking-[0.25em] text-zinc-500">
                        {barber.displayTitle || "Master Barber"}
                      </p>
                      <h3 className="text-xl font-semibold">{barber.name}</h3>
                      {barber.bio && <p className="text-sm leading-7 text-zinc-400">{barber.bio}</p>}
                      <Link
                        href={landingBookHref(hasToken, barber.id)}
                        className="inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-200"
                      >
                        رزرو با این آرایشگر
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="about" className="bg-black px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-3 text-xs tracking-[0.35em] text-zinc-500">تجربه VIP</p>
            <h2 className="text-3xl font-semibold leading-snug sm:text-5xl">
              اینجا فقط یک اصلاح نیست؛
              <span className="mt-3 block text-zinc-300">این‌جا استاندارد شخصی شماست.</span>
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-sm leading-8 text-zinc-400 sm:text-base">
              {landing.aboutText || FALLBACK.aboutText}
            </p>
          </div>
          <div className="mx-auto mt-14 grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-3">
            {[
              { icon: Sparkles, title: "دقت در هر جزئیات", body: "از مشاوره تا آخرین حرکت تیغ، هر مرحله با تمرکز کامل انجام می‌شود." },
              { icon: Shield, title: "فضای خصوصی و آرام", body: "جایی برای نفس کشیدن، فکر کردن و تازه‌ شدن؛ بدون شلوغی." },
              { icon: Clock, title: "احترام به زمان شما", body: "نوبت‌ها با دقت برنامه‌ریزی می‌شوند تا بدون معطلی سرویس بگیرید." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/10 bg-[#080808] p-8">
                <item.icon className="mb-5 h-6 w-6 text-white" />
                <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                <p className="text-sm leading-7 text-zinc-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="bg-[#080808] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              <p className="text-xs tracking-[0.35em] text-zinc-500">ساعات کاری و تماس</p>
              <h2 className="text-3xl font-semibold sm:text-4xl">سالن دوکارد</h2>
              <p className="text-sm leading-7 text-zinc-400">{landing.contact}</p>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500">شنبه تا پنجشنبه</p>
                    <p>{hours.weekdays}</p>
                    <p className="mt-2 text-zinc-500">جمعه</p>
                    <p>{hours.friday}</p>
                    {hours.note && <p className="mt-2 text-zinc-500">{hours.note}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Phone className="mt-0.5 h-5 w-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500">تلفن</p>
                    <a href={`tel:${tel}`} className="hover:underline" dir="ltr">
                      {landing.phone}
                    </a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500">آدرس</p>
                    <p>{landing.address}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Instagram className="mt-0.5 h-5 w-5 text-zinc-400" />
                  <div>
                    <p className="text-zinc-500">اینستاگرام</p>
                    <a href={ig} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      doocard
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <LandingMap address={landing.address} />
          </div>
        </section>
      </main>

      <footer
        className="border-t border-white/10 bg-black px-4 py-10"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="tracking-[0.3em] text-sm">DOOCARD BARBERSHOP</p>
            <p className="mt-2 text-xs text-zinc-500">{landing.address}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400">
            <a href={`tel:${tel}`} dir="ltr">
              {landing.phone}
            </a>
            <Link href="/products" className="hover:text-white">
              فروشگاه
            </Link>
            <a href={ig} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-white"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <ArrowUp className="h-4 w-4" />
              بالا
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
