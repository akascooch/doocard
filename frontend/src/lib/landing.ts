export type LandingHours = {
  weekdays?: string
  friday?: string
  note?: string
}

export type LandingSlide = {
  id: number
  imageUrl: string
  title?: string | null
  subtitle?: string | null
  sortOrder?: number
  isActive?: boolean
}

export type LandingStaff = {
  id: number
  name: string
  displayTitle?: string | null
  bio?: string | null
  avatarUrl?: string | null
  sortOrder?: number
}

export type LandingPublicData = {
  heroTitle: string
  heroSubtitle: string
  aboutText: string
  contact: string
  phone: string
  address: string
  instagramUrl: string
  workingHours: string
  slides: LandingSlide[]
  staff: LandingStaff[]
}

export const DEFAULT_HOURS: LandingHours = {
  weekdays: "۱۰:۰۰ – ۲۲:۰۰",
  friday: "۱۱:۰۰ – ۲۰:۰۰",
  note: "هماهنگی از طریق رزرو آنلاین",
}

export function parseWorkingHours(raw?: string | null): LandingHours {
  if (!raw) return { ...DEFAULT_HOURS }
  try {
    const parsed = JSON.parse(raw) as LandingHours
    if (parsed && typeof parsed === "object") {
      return {
        weekdays: parsed.weekdays || DEFAULT_HOURS.weekdays,
        friday: parsed.friday || DEFAULT_HOURS.friday,
        note: parsed.note || "",
      }
    }
  } catch {
    return { ...DEFAULT_HOURS, note: raw }
  }
  return { ...DEFAULT_HOURS }
}

export function stringifyWorkingHours(hours: LandingHours): string {
  return JSON.stringify({
    weekdays: hours.weekdays || "",
    friday: hours.friday || "",
    note: hours.note || "",
  })
}

export function phoneToTel(phone?: string | null): string {
  const digits = (phone || "02126353460").replace(/\D/g, "")
  if (digits.startsWith("98")) return `+${digits}`
  if (digits.startsWith("0")) return `+98${digits.slice(1)}`
  return `+98${digits}`
}

export function instagramHref(url?: string | null): string {
  const value = (url || "https://www.instagram.com/doocard").trim()
  if (value.startsWith("http")) return value
  const handle = value.replace(/^@/, "")
  return `https://www.instagram.com/${handle}`
}

export function landingBookHref(hasToken: boolean, employeeId?: number): string {
  const q = employeeId ? `?employeeId=${employeeId}` : ""
  if (employeeId) return `/book-appointment${q}`
  return hasToken ? "/book-appointment" : "/register"
}

export function readAuthToken(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem("token")
  } catch {
    return null
  }
}
