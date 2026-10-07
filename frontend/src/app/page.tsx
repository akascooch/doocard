"use client"

import "./homepage-background.css"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUp, Calendar, Clock, Instagram, MapPin, Phone, Shield, Sparkles } from "lucide-react"
import { initializeRouterStateCleanup } from "@/lib/clearRouterState"
import { initializeCacheClearing } from "@/lib/clearBrowserCache"
import { AppLogo } from "@/components/common/AppLogo"
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
  const [bookHref, setBookHref] = useState("/book-appointment")
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
    <div className="min-h-screen scroll-smooth bg-background text-foreground">
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
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-card" />
          <div className="relative z-10 mx-auto flex min-h-[88vh] max-w-5xl flex-col items-center justify-center px-4 py-16 text-center sm:py-20">
            <AppLogo
              size="lg"
              centered
              className="mb-4 h-48 w-48 object-contain sm:h-64 sm:w-64"
              priority
            />
            <p className="mb-6 text-[11px] tracking-[0.42em] text-foreground">
              {detailsLoading ? "…" : landing.heroSubtitle || "PRECISION IN EVERY DETAIL"}
            </p>
            <h1 className="text-4xl font-semibold tracking-[0.12em] text-foreground sm:text-6xl md:text-7xl">
              {landing.heroTitle || "DOOCARD BARBERSHOP"}
            </h1>
            <p className="mt-8 max-w-2xl text-sm leading-8 text-foreground sm:text-base">
              {detailsLoading
                ? "در حال آماده‌سازی تجربه‌ی شما..."
                : landing.aboutText || FALLBACK.aboutText}
            </p>
            <div className="mt-10 flex w-full max-w-md flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">
              {/* [GATED-W-B] Brand primary CTA — solid white kept pending Wave B product decision (AUDIT_GLASS_CONVERSION_20260922). */}
              <Link
                href={bookHref}
                className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Calendar className="ml-2 h-4 w-4" />
                رزرو آنلاین نوبت
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center rounded-md border border-border px-8 py-3.5 text-sm text-foreground hover:bg-primary/10"
              >
                مشاهده خدمات
              </a>
            </div>
          </div>
        </section>

        <section id="gallery" className="bg-card px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="mb-3 text-xs tracking-[0.35em] text-foreground">گالری</p>
            <h2 className="mb-10 text-3xl font-semibold tracking-wide sm:text-4xl">فضا و جزئیات</h2>
            <LandingCarousel slides={landing.slides} />
          </div>
        </section>

        <section id="services" className="bg-background px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="mb-3 text-center text-xs tracking-[0.35em] text-foreground">خدمات</p>
            <h2 className="mb-4 text-center text-3xl font-semibold sm:text-4xl">خدمات تخصصی دوکارد</h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-sm text-foreground">
              هر خدمت با دقت و زمان مشخص ارائه می‌شود.
            </p>
            {servicesError && <p className="mb-8 text-center text-sm text-destructive">{servicesError}</p>}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {servicesLoading && services.length === 0 &&
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
                ))}
              {services.map((service) => (
                <article
                  key={service.id}
                  className="flex h-full flex-col justify-between rounded-2xl border border-border bg-card px-6 py-6"
                >
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] text-foreground">
                      <Sparkles className="h-3 w-3" />
                      خدمت تخصصی
                    </div>
                    <h3 className="text-xl font-semibold">{service.name}</h3>
                    {service.description && (
                      <p className="text-sm leading-7 text-foreground">{service.description}</p>
                    )}
                  </div>
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                    <span className="text-foreground">{formatDuration(service.durationMinutes)}</span>
                    <Link
                      href={bookHref}
                      /* [GATED-W-B] Brand primary CTA — Wave B product decision */
                      className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-xs font-semibold text-primary-foreground touch-manipulation hover:bg-primary/90"
                    >
                      رزرو
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="team" className="bg-card px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <p className="mb-3 text-xs tracking-[0.35em] text-foreground">تیم دوکارد</p>
            <h2 className="mb-10 text-3xl font-semibold sm:text-4xl">آرایشگران ارشد</h2>
            {landing.staff.length === 0 ? (
              <p className="text-sm text-foreground">اعضای تیم به‌زودی از پنل مدیریت معرفی می‌شوند.</p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {landing.staff.map((barber) => (
                  <article key={barber.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="aspect-[4/5] bg-background">
                      {barber.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={barber.avatarUrl}
                          alt={barber.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-foreground">بدون تصویر</div>
                      )}
                    </div>
                    <div className="space-y-3 p-5">
                      <p className="text-[11px] tracking-[0.25em] text-foreground">
                        {barber.displayTitle || "Master Barber"}
                      </p>
                      <h3 className="text-xl font-semibold">{barber.name}</h3>
                      {barber.bio && <p className="text-sm leading-7 text-foreground">{barber.bio}</p>}
                      <Link
                        href={landingBookHref(hasToken, barber.id)}
                        /* [GATED-W-B] Brand primary CTA — Wave B product decision */
                        className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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

        <section id="about" className="bg-background px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-3 text-xs tracking-[0.35em] text-foreground">تجربه VIP</p>
            <h2 className="text-3xl font-semibold leading-snug sm:text-5xl">
              اینجا فقط یک اصلاح نیست؛
              <span className="mt-3 block text-foreground">این‌جا استاندارد شخصی شماست.</span>
            </h2>
            <p className="mx-auto mt-8 max-w-2xl text-sm leading-8 text-foreground sm:text-base">
              {landing.aboutText || FALLBACK.aboutText}
            </p>
          </div>
          <div className="mx-auto mt-14 grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-3">
            {[
              { icon: Sparkles, title: "دقت در هر جزئیات", body: "از مشاوره تا آخرین حرکت تیغ، هر مرحله با تمرکز کامل انجام می‌شود." },
              { icon: Shield, title: "فضای خصوصی و آرام", body: "جایی برای نفس کشیدن، فکر کردن و تازه‌ شدن؛ بدون شلوغی." },
              { icon: Clock, title: "احترام به زمان شما", body: "نوبت‌ها با دقت برنامه‌ریزی می‌شوند تا بدون معطلی سرویس بگیرید." },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border bg-card p-8">
                <item.icon className="mb-5 h-6 w-6 text-foreground" />
                <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                <p className="text-sm leading-7 text-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="contact" className="bg-card px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl grid-cols-1 items-start gap-10 lg:grid-cols-2">
            <div className="space-y-6">
              <p className="text-xs tracking-[0.35em] text-foreground">ساعات کاری و تماس</p>
              <h2 className="text-3xl font-semibold sm:text-4xl">سالن دوکارد</h2>
              <p className="text-sm leading-7 text-foreground">{landing.contact}</p>
              <div className="space-y-4 text-sm">
                <div className="flex gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-foreground" />
                  <div>
                    <p className="text-foreground">شنبه تا پنجشنبه</p>
                    <p>{hours.weekdays}</p>
                    <p className="mt-2 text-foreground">جمعه</p>
                    <p>{hours.friday}</p>
                    {hours.note && <p className="mt-2 text-foreground">{hours.note}</p>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Phone className="mt-0.5 h-5 w-5 text-foreground" />
                  <div>
                    <p className="text-foreground">تلفن</p>
                    <a href={`tel:${tel}`} className="hover:underline" dir="ltr">
                      {landing.phone}
                    </a>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 text-foreground" />
                  <div>
                    <p className="text-foreground">آدرس</p>
                    <p>{landing.address}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Instagram className="mt-0.5 h-5 w-5 text-foreground" />
                  <div>
                    <p className="text-foreground">اینستاگرام</p>
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
        className="border-t border-border bg-background px-4 py-10"
        style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <p className="tracking-[0.3em] text-sm">DOOCARD BARBERSHOP</p>
            <p className="mt-2 text-xs text-foreground">{landing.address}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-foreground">
            <a href={`tel:${tel}`} dir="ltr">
              {landing.phone}
            </a>
            <Link href="/products" className="hover:text-foreground">
              فروشگاه
            </Link>
            <a href={ig} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1">
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-foreground"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              <ArrowUp className="h-4 w-4" />
              بالا
            </button>
          </div>
        </div>
        <p
          className="mx-auto mt-8 max-w-7xl text-center text-xs tracking-[0.18em] text-foreground"
          dir="ltr"
        >
          Powered by TECHOOCH
        </p>
      </footer>
    </div>
  )
}
