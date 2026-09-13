"use client"

import { useCallback, useEffect, useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import PersianDatePicker from "@/components/ui/PersianDatePicker"
import { getApiErrorMessage, notifyError, notifySuccess } from "@/lib/notify"
import { formatNumberWithCommas, formatRials } from "@/lib/money"
import { getTehranTodayJalali, jalaliToGregorian, persianToEnglishDigits } from "@/lib/date"
import { getCurrentUser } from "@/lib/auth"
import { getDashboardHomePath } from "@/lib/user-roles"
import api from "@/lib/axios"
import { Loader2, Trash2, Wallet } from "lucide-react"

const CATEGORIES = [
  { id: "SALON_SUPPLIES", label: "ملزومات سالن" },
  { id: "FOOD_REFRESHMENT", label: "پذیرایی و خوراک" },
  { id: "PETTY_CASH", label: "تنخواه" },
  { id: "UTILITY", label: "قبوض و خدمات" },
  { id: "PERSONAL", label: "شخصی مدیر" },
] as const

type CategoryId = (typeof CATEGORIES)[number]["id"]

/** Same cap as backend MAX_AMOUNT_RIAL — integer rials only. */
const MAX_AMOUNT_RIAL = 99_999_999_999_999

type Expense = {
  id: string
  amount: string
  category: CategoryId
  title: string
  description: string | null
  dateKey: string
}

function jalaliToDateKey(jalali: string): string {
  return jalaliToGregorian(jalali) || ""
}

function parseExpenseAmount(raw: string): { ok: true; value: string } | { ok: false; reason: string } {
  const english = persianToEnglishDigits(raw)
  if (/[.\u066B]/.test(english)) {
    return { ok: false, reason: "مبلغ اعشاری مجاز نیست" }
  }
  const digits = english.replace(/[,،\s]/g, "")
  if (!digits) return { ok: false, reason: "مبلغ را وارد کنید" }
  if (!/^\d+$/.test(digits)) return { ok: false, reason: "مبلغ باید عدد صحیح ریال باشد" }
  if (digits.length > 14) return { ok: false, reason: "مبلغ بیش از حد مجاز است" }
  const asNumber = Number(digits)
  if (!Number.isSafeInteger(asNumber) || asNumber < 1 || asNumber > MAX_AMOUNT_RIAL) {
    return { ok: false, reason: "مبلغ خارج از محدوده مجاز است" }
  }
  return { ok: true, value: digits }
}

function formatAmountRial(amount: string): string {
  const n = Number(amount)
  return Number.isFinite(n) ? formatRials(n) : `${amount} ریال`
}

export default function AdminPersonalExpensesPage() {
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<CategoryId>("PETTY_CASH")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dateJalali, setDateJalali] = useState(getTehranTodayJalali())
  const [fromJalali, setFromJalali] = useState("")
  const [toJalali, setToJalali] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<Expense[]>([])
  const [summary, setSummary] = useState({ today: "0", week: "0", month: "0" })
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const pageSize = 10

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== "ADMIN") {
      window.location.replace(getDashboardHomePath(currentUser?.role))
    }
  }, [])

  const load = useCallback(async (nextPage = 1) => {
    try {
      const params: Record<string, string | number> = { page: nextPage, pageSize }
      if (fromJalali) params.from = jalaliToDateKey(fromJalali)
      if (toJalali) params.to = jalaliToDateKey(toJalali)
      const [listRes, sumRes] = await Promise.all([
        api.get("/admin/personal/expenses", { params }),
        api.get("/admin/personal/expenses/summary"),
      ])
      setItems(listRes.data.items || [])
      setTotal(listRes.data.total || 0)
      setPage(listRes.data.page || nextPage)
      setSummary({
        today: String(sumRes.data.today ?? "0"),
        week: String(sumRes.data.week ?? "0"),
        month: String(sumRes.data.month ?? "0"),
      })
    } catch (error) {
      notifyError("هزینه‌های شخصی", getApiErrorMessage(error, "بارگذاری ناموفق بود"))
    } finally {
      setLoading(false)
    }
  }, [fromJalali, toJalali])

  useEffect(() => {
    void load(1)
  }, [load])

  const submit = async () => {
    const parsed = parseExpenseAmount(amount)
    if (!parsed.ok) {
      notifyError("مبلغ نامعتبر", parsed.reason)
      return
    }
    if (title.trim().length < 2) {
      notifyError("عنوان الزامی است", "عنوان هزینه را بنویسید")
      return
    }
    const dateKey = jalaliToDateKey(dateJalali)
    setSaving(true)
    try {
      await api.post("/admin/personal/expenses", {
        amount: parsed.value,
        category,
        title: title.trim(),
        description: description.trim() || undefined,
        dateKey: dateKey || undefined,
      })
      notifySuccess("ثبت شد", "هزینه شخصی به تنخواه سالن اضافه شد")
      setAmount("")
      setTitle("")
      setDescription("")
      await load(1)
    } catch (error) {
      notifyError("ثبت ناموفق", getApiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await api.delete(`/admin/personal/expenses/${deleteId}`)
      notifySuccess("حذف شد")
      setDeleteId(null)
      await load(page)
    } catch (error) {
      notifyError("حذف ناموفق", getApiErrorMessage(error))
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">هزینه‌های شخصی و تنخواه</h1>
        <p className="text-muted-foreground mt-1">
          ثبت سریع هزینه‌های روزمره سالن — جدا از فاکتور و نوبت مشتریان. واحد: ریال.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>امروز</CardDescription>
            <CardTitle data-cy="expense-summary-today" className="text-xl break-words">{formatAmountRial(summary.today)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>۷ روز اخیر</CardDescription>
            <CardTitle className="text-xl break-words">{formatAmountRial(summary.week)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>این ماه</CardDescription>
            <CardTitle className="text-xl break-words">{formatAmountRial(summary.month)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            ثبت سریع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>مبلغ (ریال)</Label>
            <Input
              data-cy="expense-amount"
              dir="ltr"
              inputMode="numeric"
              placeholder="1,250,000"
              value={amount}
              onChange={(e) => {
                const raw = e.target.value
                const english = persianToEnglishDigits(raw)
                if (/[-.٫\u066B]/.test(english)) {
                  setAmount(raw)
                  return
                }
                setAmount(formatNumberWithCommas(raw))
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>دسته‌بندی</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCategory(item.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    category === item.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>عنوان</Label>
            <Input data-cy="expense-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً خرید تیغ" />
          </div>
          <PersianDatePicker
            value={dateJalali}
            onChange={setDateJalali}
            label="تاریخ"
          />
          <div className="space-y-2">
            <Label>یادداشت</Label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="button" disabled={saving} onClick={() => void submit()} data-cy="expense-submit">
            {saving ? "در حال ثبت..." : "ثبت هزینه"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>فهرست</CardTitle>
          <CardDescription>فیلتر تاریخ شمسی و صفحه‌بندی. حذف نرم است و از جمع‌ها خارج می‌شود.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <PersianDatePicker value={fromJalali} onChange={setFromJalali} label="از تاریخ" />
            <PersianDatePicker value={toJalali} onChange={setToJalali} label="تا تاریخ" />
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">هزینه‌ای در این بازه نیست.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} data-cy="expense-row" data-title={item.title} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatAmountRial(item.amount)} · {CATEGORIES.find((c) => c.id === item.category)?.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="normal-case tracking-normal">
                      {item.dateKey}
                    </Badge>
                    <Button type="button" variant="ghost" size="icon" data-cy="expense-delete" onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {total > pageSize ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={page <= 1} onClick={() => void load(page - 1)}>
                قبلی
              </Button>
              <Button type="button" variant="outline" disabled={page >= pageCount} onClick={() => void load(page + 1)}>
                بعدی
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent data-cy="expense-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف هزینه؟</AlertDialogTitle>
            <AlertDialogDescription>
              این ردیف از فهرست و جمع‌ها خارج می‌شود. به دفتر کل سالن و فاکتور مشتریان وصل نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-cy="expense-delete-cancel">انصراف</AlertDialogCancel>
            <AlertDialogAction data-cy="expense-delete-confirm" onClick={() => void confirmDelete()}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
