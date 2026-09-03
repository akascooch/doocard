"use client"

import "./homepage-background.css"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Calendar, Phone, MapPin, Clock, Shield, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { initializeRouterStateCleanup } from "@/lib/clearRouterState"
import { initializeCacheClearing } from "@/lib/clearBrowserCache"
import { AppLogo } from "@/components/common/AppLogo"
import Footer from "@/components/Footer"

interface HomepageDetails {
  about?: string
  products?: string
  contact?: string
}

interface Service {
  id: number
  name: string
  description?: string
  price?: number
  durationMinutes?: number
}

function formatPriceToToman(price?: number) {
  if (!price || Number.isNaN(price)) return "قیمت نامشخص"
  const toman = Math.round(price / 10)
  return `${new Intl.NumberFormat("fa-IR").format(toman)} تومان`
}

function formatDuration(minutes?: number) {
  if (!minutes || Number.isNaN(minutes)) return "مدت زمان نامشخص"
  return `${minutes} دقیقه`
}

export default function HomePage() {
  const [homepageDetails, setHomepageDetails] = useState<HomepageDetails>({})
  const [detailsLoading, setDetailsLoading] = useState(true)

  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState<string | null>(null)

  useEffect(() => {
    initializeCacheClearing()
    initializeRouterStateCleanup()
    fetchHomepageDetails()

    document.body.style.backgroundImage = "url('/images/mainbackground.jpg')"
    document.body.style.backgroundSize = "cover"
    document.body.style.backgroundPosition = "center top"
    document.body.style.backgroundRepeat = "no-repeat"
    document.body.style.backgroundAttachment = "scroll"
    document.body.style.backgroundColor = "transparent"
  }, [])

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setServicesLoading(true)
        setServicesError(null)
        const res = await fetch("/api/services/public")
        if (!res.ok) {
          throw new Error("خطا در دریافت خدمات")
        }
        const data = await res.json()
        if (Array.isArray(data)) {
          setServices(data)
        } else {
          setServices([])
        }
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

  const fetchHomepageDetails = async () => {
    try {
      const response = await fetch("/api/homepage")
      if (response.ok) {
        const data = await response.json()
        setHomepageDetails(data)
      }
    } catch (error) {
      console.error("Error fetching homepage details:", error)
    } finally {
      setDetailsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden text-foreground">
      {/* Navigation */}
      <header className="fixed top-0 right-0 left-0 z-40 border-b border-border/40 bg-black/40 backdrop-blur-xl safe-area-top safe-area-inline">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between gap-3 md:gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden sm:h-12 sm:w-12">
                <AppLogo size="sm" animated={false} />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-lg sm:text-xl font-bold tracking-tight">آرایشگاه مردانه دوکارد</span>
                <span className="text-[11px] sm:text-xs text-muted-foreground">
                  تجربه‌ای خصوصی برای آقایان سخت‌پسند
                </span>
              </div>
            </div>
            <nav className="hidden shrink-0 md:flex items-center gap-8 text-sm">
              <a href="#home" className="hover:text-primary transition-colors">
                خانه
              </a>
              <a href="#services" className="hover:text-primary transition-colors">
                خدمات
              </a>
              <a href="#booking" className="hover:text-primary transition-colors">
                رزرو
              </a>
              <a href="#contact" className="hover:text-primary transition-colors">
                تماس
              </a>
            </nav>
            <div className="hidden shrink-0 sm:flex items-center gap-3">
              <Link href="/login">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-border/60 bg-black/40 text-foreground hover:bg-black/70 rounded-md"
                >
                  ورود
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  size="sm"
                  className="rounded-md bg-[#c6a75e] text-black hover:bg-[#b5964e] shadow-[0_0_25px_rgba(198,167,94,0.6)]"
                >
                  رزرو نوبت
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-24">
        {/* Hero */}
        <section
          id="home"
          className="relative min-h-[80vh] flex items-center justify-center px-4 sm:px-6 lg:px-8"
        >
          <div className="absolute inset-0 bg-black/85" aria-hidden="true" />
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black via-transparent to-transparent" />

          <div className="relative z-10 max-w-5xl mx-auto text-center space-y-10">
            <div className="inline-flex items-center gap-3 px-5 py-2 border border-[#c6a75e]/40 bg-black/40 rounded-full text-xs tracking-[0.3em] text-[#c6a75e]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#c6a75e]" />
              <span>دوکارد آرایشگاه مردانه – تهران</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-[#f5f1e8] leading-tight tracking-tight">
              استاندارد جدیدی از
              <span className="block mt-2 text-[#c6a75e]">اصلاح مردانه لوکس</span>
            </h1>

            <p className="text-sm sm:text-base md:text-xl text-[#c9c5ba] max-w-3xl mx-auto leading-relaxed">
              {detailsLoading
                ? "در حال آماده‌سازی تجربه‌ی شما..."
                : homepageDetails.about ||
                  "در قلب تهران، فضایی خصوصی و آرام برای آقایانی که به جزئیات، سکوت و دقت اهمیت می‌دهند."}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
              <Link href="/register">
                <Button
                  size="lg"
                  className="rounded-md px-10 py-6 bg-[#c6a75e] text-black text-base sm:text-lg font-bold tracking-wide shadow-[0_0_40px_rgba(198,167,94,0.7)] hover:bg-[#b5964e]"
                >
                  <Calendar className="w-5 h-5 ml-2" />
                  رزرو آنلاین نوبت
                </Button>
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center rounded-md border border-[#c6a75e]/60 bg-black/40 px-8 py-4 text-sm sm:text-base text-[#f5f1e8] hover:bg-black/70 transition-colors"
              >
                مشاهده خدمات
              </a>
            </div>
          </div>
        </section>

        {/* Services – real backend data */}
        <section
          id="services"
          className="relative py-20 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8"
        >
          <div className="absolute inset-0 bg-black/85" aria-hidden="true" />
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <p className="text-xs sm:text-sm tracking-[0.3em] text-[#8a8678] mb-4">
                خدمات انتخاب‌شده برای آقایان
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#f5f1e8] mb-4">
                خدمات تخصصی دوکارد
              </h2>
              <p className="text-sm sm:text-base text-[#c9c5ba] max-w-2xl mx-auto">
                هر خدمت با دقت، زمان مشخص و قیمت شفاف ارائه می‌شود تا تجربه‌ای مطمئن و
                بدون عجله داشته باشید.
              </p>
            </div>

            {servicesError && (
              <p className="text-center text-sm text-red-400 mb-8">{servicesError}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {servicesLoading && services.length === 0 && (
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-40 rounded-xl border border-border/40 bg-black/40 animate-pulse"
                    />
                  ))}
                </>
              )}

              {services.map((service) => (
                <article
                  key={service.id}
                  className="relative h-full rounded-xl border border-[#c6a75e]/25 bg-black/70 px-6 py-6 sm:px-8 sm:py-8 flex flex-col justify-between shadow-[0_18px_40px_rgba(0,0,0,0.8)]"
                >
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-[#c6a75e]/40 px-3 py-1 text-[11px] text-[#c6a75e]">
                      <Sparkles className="w-3 h-3" />
                      <span>خدمت تخصصی</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-[#f5f1e8]">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="text-sm text-[#c9c5ba] leading-relaxed">
                        {service.description}
                      </p>
                    )}
                  </div>
                  <div className="mt-6 pt-4 border-t border-[#c6a75e]/25 flex items-center justify-between text-sm">
                    <span className="text-[#8a8678]">
                      {formatDuration(service.durationMinutes)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Experience statement – ultra-premium block */}
        <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-black/85" aria-hidden="true" />
          <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
            <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-[#c6a75e] to-transparent" />
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-bold text-[#f5f1e8] leading-tight">
              اینجا فقط یک اصلاح نیست؛
              <span className="block mt-4 text-[#c6a75e]">
                این‌جا استاندارد شخصی شماست.
              </span>
            </h2>
            <p className="text-sm sm:text-lg text-[#c9c5ba] max-w-3xl mx-auto leading-relaxed">
              هر بار که وارد دوکارد می‌شوید، نه‌تنها ظاهر شما، بلکه حس شما نسبت به
              خودتان ارتقا پیدا می‌کند. تمرکز ما روی سکوت، نظم، دقت و احترام به زمان
              شماست.
            </p>
            <div className="h-px w-48 mx-auto bg-gradient-to-r from-transparent via-[#c6a75e] to-transparent" />
          </div>
        </section>

        {/* Why Doocard – principles */}
        <section className="relative py-20 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-black/85" aria-hidden="true" />
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-xs sm:text-sm tracking-[0.3em] text-[#8a8678] mb-4">
                فلسفه دوکارد
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#f5f1e8]">
                چرا <span className="text-[#c6a75e]">دوکارد</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              <div className="rounded-xl border border-[#c6a75e]/30 bg-black/70 p-8 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
                <div className="w-12 h-12 rounded-full border border-[#c6a75e]/50 flex items-center justify-center mb-6">
                  <Sparkles className="w-6 h-6 text-[#c6a75e]" />
                </div>
                <h3 className="text-xl font-bold text-[#f5f1e8] mb-3">دقت در هر جزئیات</h3>
                <p className="text-sm text-[#c9c5ba] leading-relaxed">
                  از اولین مشاوره تا آخرین حرکت تیغ، هر مرحله با تمرکز کامل و مطابق با
                  سلیقه و چهره شما انجام می‌شود.
                </p>
              </div>
              <div className="rounded-xl border border-[#c6a75e]/30 bg-black/70 p-8 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
                <div className="w-12 h-12 rounded-full border border-[#c6a75e]/50 flex items-center justify-center mb-6">
                  <Shield className="w-6 h-6 text-[#c6a75e]" />
                </div>
                <h3 className="text-xl font-bold text-[#f5f1e8] mb-3">فضای خصوصی و آرام</h3>
                <p className="text-sm text-[#c9c5ba] leading-relaxed">
                  فضایی که شلوغ و پر سر و صدا نیست؛ جایی برای نفس کشیدن، فکر کردن و
                  تازه‌ شدن.
                </p>
              </div>
              <div className="rounded-xl border border-[#c6a75e]/30 bg-black/70 p-8 shadow-[0_18px_40px_rgba(0,0,0,0.8)]">
                <div className="w-12 h-12 rounded-full border border-[#c6a75e]/50 flex items-center justify-center mb-6">
                  <Clock className="w-6 h-6 text-[#c6a75e]" />
                </div>
                <h3 className="text-xl font-bold text-[#f5f1e8] mb-3">احترام به زمان شما</h3>
                <p className="text-sm text-[#c9c5ba] leading-relaxed">
                  نوبت‌ها با دقت برنامه‌ریزی می‌شوند تا بدون معطلی و انتظار، سرویس خود
                  را دریافت کنید.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Booking conversion */}
        <section
          id="booking"
          className="relative py-24 sm:py-28 px-4 sm:px-6 lg:px-8"
        >
          <div className="absolute inset-0 bg-black/85" aria-hidden="true" />
          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-[#c6a75e]/40 bg-black/40 text-[#c6a75e] text-[11px] tracking-[0.25em] mb-8 rounded-full">
              <Sparkles className="w-4 h-4" />
              <span>رزرو آنلاین بدون تماس</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#f5f1e8] mb-6 leading-snug">
              در کمتر از دو دقیقه
              <span className="block mt-2 text-[#c6a75e]">صندلی خود را رزرو کنید</span>
            </h2>
            <p className="text-sm sm:text-lg text-[#c9c5ba] max-w-2xl mx-auto mb-10 leading-relaxed">
              فرم ثبت‌نام را تکمیل کنید، حساب کاربری بسازید و نوبت خود را به‌صورت
              آنلاین و امن رزرو کنید.
            </p>
            <div className="flex flex-wrap justify-center gap-6 mb-10 text-sm text-[#c9c5ba]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#c6a75e]" />
                <span>انتخاب تاریخ و ساعت دلخواه</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#c6a75e]" />
                <span>بدون انتظار و ازدحام</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#c6a75e]" />
                <span>پروفایل شخصی و تاریخچه نوبت‌ها</span>
              </div>
            </div>
            <Link href="/register">
              <Button
                size="lg"
                className="rounded-md px-16 py-6 bg-[#c6a75e] text-black text-lg font-bold tracking-wide shadow-[0_0_60px_rgba(198,167,94,0.8)] hover:bg-[#b5964e]"
              >
                <Calendar className="w-6 h-6 ml-2" />
                رزرو آنلاین فوری
              </Button>
            </Link>
          </div>
        </section>

        {/* Location / contact */}
        <section
          id="contact"
          className="relative py-20 sm:py-24 lg:py-28 px-4 sm:px-6 lg:px-8"
        >
          <div className="absolute inset-0 bg-black/85" aria-hidden="true" />
          <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div className="space-y-6">
              <p className="text-xs sm:text-sm tracking-[0.3em] text-[#8a8678]">
                اطلاعات تماس
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-[#f5f1e8]">
                برای رزرو و هماهنگی
                <span className="block mt-2 text-[#c6a75e]">مستقیم با ما در تماس باشید</span>
              </h2>
              <p className="text-sm sm:text-base text-[#c9c5ba] leading-relaxed">
                {detailsLoading
                  ? "در حال بارگذاری اطلاعات تماس..."
                  : homepageDetails.contact ||
                    "تیم دوکارد آماده پاسخ‌گویی به سوالات شما درباره خدمات، نوبت‌ها و شرایط همکاری است."}
              </p>
              <div className="space-y-4 text-sm sm:text-base">
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-[#c6a75e] mt-0.5" />
                  <div>
                    <p className="text-[#8a8678] mb-1">تلفن مستقیم سالن</p>
                    <a
                      href="tel:+982126353460"
                      className="text-[#f5f1e8] hover:text-[#c6a75e] transition-colors"
                    >
                      ۰۲۱-۲۶۳۵۳۴۶۰
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-[#c6a75e] mt-0.5" />
                  <div>
                    <p className="text-[#8a8678] mb-1">آدرس</p>
                    <p className="text-[#f5f1e8]">
                      تهران، فرشته، مجتمع سام، طبقه ۵، واحد ۱۰۳
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-bold text-[#f5f1e8]">موقعیت ما</h3>
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                <div className="w-full h-[300px] sm:h-[350px] lg:h-[400px]">
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4576.923143468721!2d51.41657430921262!3d35.790765659685626!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3f8e07007116900b%3A0x9f14de3d35145316!2sSam%20Center%20Parking!5e0!3m2!1sen!2s!4v1772003089353!5m2!1sen!2s"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="w-full h-full"
                  />
                </div>
              </div>
              <p className="text-sm text-[#c9c5ba]">
                Tehran Province, Tehran, Sam Center Parking, Tajrish, Bahar Dead End, QCR9+6Q7, Iran
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Technical footer from existing project (credits) */}
      <Footer />
    </div>
  )
}
