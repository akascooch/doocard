import { formatToJalali, parseFromJalali, safeToJalaali } from "@/lib/date"

// Persian number conversion utilities
export const toPersianDigits = (str: string): string => {
  return str.replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[parseInt(d)])
}

export const toEnglishDigits = (str: string): string => {
  return str.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
}

// Persian month names
export const persianMonths = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"
]

export const persianWeekDays = [
  "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"
]

// Jalali date formatting
export const formatJalaliDate = (date: Date, format: string = "YYYY/MM/DD"): string => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ""
  if (format === "YYYY/MM/DD") {
    return formatToJalali(date, "YYYY/MM/DD")
  }
  const jalali = safeToJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate())
  if (!jalali) return ""
  return format
    .replace("YYYY", jalali.jy.toString())
    .replace("MM", jalali.jm.toString().padStart(2, "0"))
    .replace("DD", jalali.jd.toString().padStart(2, "0"))
    .replace("MMMM", persianMonths[jalali.jm - 1] ?? "")
    .replace("dddd", persianWeekDays[date.getDay()] ?? "")
}

export const jalaliToDate = (jalaliStr: string): Date => {
  const parsed = parseFromJalali(jalaliStr)
  if (parsed) return parsed
  throw new Error("Invalid Jalali date format")
}

export const dateToJalali = (date: Date): string => {
  return formatToJalali(date, "YYYY/MM/DD")
}

// Persian number formatting
export const formatPersianNumber = (num: number): string => {
  return toPersianDigits(num.toLocaleString('fa-IR'))
}

// Persian currency formatting
export const formatPersianCurrency = (amount: number): string => {
  return `${formatPersianNumber(amount)} تومان`
}

// Persian text utilities
export const persianText = {
  // Common UI text
  loading: "در حال بارگذاری...",
  error: "خطا",
  success: "موفقیت",
  warning: "هشدار",
  info: "اطلاعات",
  
  // Actions
  save: "ذخیره",
  cancel: "لغو",
  delete: "حذف",
  edit: "ویرایش",
  add: "افزودن",
  search: "جستجو",
  filter: "فیلتر",
  reset: "بازنشانی",
  
  // Status
  active: "فعال",
  inactive: "غیرفعال",
  pending: "در انتظار",
  completed: "تکمیل شده",
  cancelled: "لغو شده",
  
  // Time
  today: "امروز",
  yesterday: "دیروز",
  tomorrow: "فردا",
  thisWeek: "این هفته",
  thisMonth: "این ماه",
  thisYear: "امسال",
  
  // Days of week
  saturday: "شنبه",
  sunday: "یکشنبه",
  monday: "دوشنبه",
  tuesday: "سه‌شنبه",
  wednesday: "چهارشنبه",
  thursday: "پنج‌شنبه",
  friday: "جمعه",
  
  // Months
  farvardin: "فروردین",
  ordibehesht: "اردیبهشت",
  khordad: "خرداد",
  tir: "تیر",
  mordad: "مرداد",
  shahrivar: "شهریور",
  mehr: "مهر",
  aban: "آبان",
  azar: "آذر",
  dey: "دی",
  bahman: "بهمن",
  esfand: "اسفند",
  
  // Common phrases
  welcome: "خوش آمدید",
  goodbye: "خداحافظ",
  thankYou: "متشکرم",
  please: "لطفاً",
  yes: "بله",
  no: "خیر",
  ok: "باشه",
  
  // Form labels
  name: "نام",
  phone: "تلفن",
  email: "ایمیل",
  address: "آدرس",
  date: "تاریخ",
  time: "زمان",
  price: "قیمت",
  amount: "مبلغ",
  description: "توضیحات",
  notes: "یادداشت‌ها",
  
  // Validation messages
  required: "این فیلد الزامی است",
  invalidEmail: "ایمیل معتبر نیست",
  invalidPhone: "شماره تلفن معتبر نیست",
  minLength: "حداقل تعداد کاراکتر",
  maxLength: "حداکثر تعداد کاراکتر",
  invalidDate: "تاریخ معتبر نیست",
  
  // Dashboard
  dashboard: "داشبورد",
  appointments: "نوبت‌ها",
  customers: "مشتریان",
  employees: "کارمندان",
  services: "خدمات",
  accounting: "حسابداری",
  reports: "گزارشات",
  settings: "تنظیمات",
  
  // Appointment status
  appointmentPending: "در انتظار تایید",
  appointmentConfirmed: "تایید شده",
  appointmentCompleted: "تکمیل شده",
  appointmentCancelled: "لغو شده",
  
  // Payment methods
  cash: "نقدی",
  card: "کارت",
  online: "آنلاین",
  
  // Transaction types
  service: "خدمات",
  tip: "انعام",
  expense: "هزینه",
  salary: "حقوق",
}

// RTL text direction utility
export const isRTL = (text: string): boolean => {
  const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/
  return rtlChars.test(text)
}

// Persian text truncation
export const truncatePersianText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + "..."
}

// Persian text search
export const persianSearch = (text: string, query: string): boolean => {
  const normalizedText = toEnglishDigits(text.toLowerCase())
  const normalizedQuery = toEnglishDigits(query.toLowerCase())
  return normalizedText.includes(normalizedQuery)
}
