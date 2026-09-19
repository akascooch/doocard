"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage, notifyError, notifySuccess } from "@/lib/notify"
import { formatNumberWithCommas, formatRials } from "@/lib/money"
import { persianToEnglishDigits } from "@/lib/date"
import { getCurrentUser } from "@/lib/auth"
import { getDashboardHomePath } from "@/lib/user-roles"
import api from "@/lib/axios"
import { Gift, Loader2, Plus, Search } from "lucide-react"

type Template = {
  id: string
  title: string
  description: string | null
  priceRial: string
  validityDays: number
  totalSessions: number
  serviceId: number
  serviceName: string | null
  pointsRequired: number | null
  isActive: boolean
}

type ServiceRow = { id: number; name: string }
type CustomerHit = { id: number; user?: { name?: string; phone?: string } }

const PAYMENTS = [
  { id: "CASH", label: "نقد" },
  { id: "CARD", label: "کارت" },
  { id: "WALLET", label: "کیف پول مشتری" },
  { id: "COMPLIMENTARY", label: "هدیه" },
] as const

export default function AdminPackagesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [services, setServices] = useState<ServiceRow[]>([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [price, setPrice] = useState("")
  const [validityDays, setValidityDays] = useState("90")
  const [totalSessions, setTotalSessions] = useState("5")
  const [serviceId, setServiceId] = useState("")
  const [pointsRequired, setPointsRequired] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null)
  const [assignTemplateId, setAssignTemplateId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]["id"]>("CASH")
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null)
  const [adjustPoints, setAdjustPoints] = useState("")
  const [adjustNotes, setAdjustNotes] = useState("")
  const [rateRial, setRateRial] = useState("1000")
  const [minRedeem, setMinRedeem] = useState("100")

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== "ADMIN") {
      window.location.replace(getDashboardHomePath(currentUser?.role))
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tpl, svc, loyaltySettings] = await Promise.all([
        api.get("/packages/templates"),
        api.get("/services"),
        api.get("/admin/loyalty/settings"),
      ])
      const items = (tpl.data.items || []) as Template[]
      setTemplates(items)
      const svcRows = Array.isArray(svc.data) ? svc.data : svc.data?.items || []
      setServices(svcRows.map((row: ServiceRow) => ({ id: row.id, name: row.name })))
      setServiceId((current) => current || (svcRows[0]?.id ? String(svcRows[0].id) : ""))
      setAssignTemplateId((current) => current || items[0]?.id || "")
      setRateRial(String(loyaltySettings.data.rialsPerPoint ?? 1000))
      setMinRedeem(String(loyaltySettings.data.minRedeemPoints ?? 100))
    } catch (error) {
      notifyError("پکیج", getApiErrorMessage(error, "بارگذاری ناموفق بود"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setEditingId(null)
    setTitle("")
    setDescription("")
    setPrice("")
    setValidityDays("90")
    setTotalSessions("5")
    setPointsRequired("")
  }

  const saveTemplate = async () => {
    const digits = persianToEnglishDigits(price).replace(/[,،\s]/g, "")
    if (!title.trim() || !/^\d+$/.test(digits) || !serviceId) return
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        priceRial: digits,
        validityDays: Number(validityDays),
        totalSessions: Number(totalSessions),
        serviceId: Number(serviceId),
        pointsRequired: pointsRequired.trim()
          ? Number(persianToEnglishDigits(pointsRequired))
          : undefined,
      }
      if (editingId) {
        await api.patch(`/packages/templates/${editingId}`, payload)
        notifySuccess("پکیج ویرایش شد")
      } else {
        await api.post("/packages/templates", payload)
        notifySuccess("پکیج ایجاد شد")
      }
      resetForm()
      await load()
    } catch (error) {
      notifyError("پکیج", getApiErrorMessage(error, "ذخیره ناموفق بود"))
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (id: string) => {
    try {
      await api.delete(`/packages/templates/${id}`)
      notifySuccess("پکیج غیرفعال شد")
      await load()
    } catch (error) {
      notifyError("پکیج", getApiErrorMessage(error, "غیرفعال‌سازی ناموفق بود"))
    }
  }

  const runSearch = async () => {
    const q = search.trim()
    if (q.length < 2) return
    try {
      const res = await api.get("/customers", { params: { search: q } })
      const rows = Array.isArray(res.data) ? res.data : []
      setHits(rows)
    } catch (error) {
      notifyError("جستجو", getApiErrorMessage(error, "جستجوی مشتری ناموفق بود"))
    }
  }

  const pickCustomer = async (row: CustomerHit) => {
    setSelectedCustomer(row)
    try {
      const res = await api.get(`/admin/loyalty/customer/${row.id}`)
      setLoyaltyPoints(res.data.points ?? 0)
    } catch {
      setLoyaltyPoints(null)
    }
  }

  const assign = async () => {
    if (!selectedCustomer || !assignTemplateId) return
    setSaving(true)
    try {
      await api.post("/packages/assign", {
        customerId: selectedCustomer.id,
        packageTemplateId: assignTemplateId,
        paymentMethod,
      })
      notifySuccess("پکیج برای مشتری ثبت شد")
    } catch (error) {
      notifyError("واگذاری", getApiErrorMessage(error, "واگذاری ناموفق بود"))
    } finally {
      setSaving(false)
    }
  }

  const adjustLoyalty = async () => {
    if (!selectedCustomer) return
    const delta = Number(persianToEnglishDigits(adjustPoints))
    if (!Number.isInteger(delta) || delta === 0 || adjustNotes.trim().length < 3) return
    try {
      const res = await api.post("/admin/loyalty/adjust-points", {
        customerId: selectedCustomer.id,
        points: delta,
        notes: adjustNotes.trim(),
      })
      setLoyaltyPoints(res.data.points)
      setAdjustPoints("")
      notifySuccess("امتیاز به‌روز شد")
    } catch (error) {
      notifyError("امتیاز", getApiErrorMessage(error, "ثبت امتیاز ناموفق بود"))
    }
  }

  const saveLoyaltySettings = async () => {
    const rate = Number(persianToEnglishDigits(rateRial))
    const min = Number(persianToEnglishDigits(minRedeem))
    if (!Number.isInteger(rate) || rate < 1 || !Number.isInteger(min) || min < 1) return
    try {
      const res = await api.patch("/admin/loyalty/settings", {
        loyaltyRateRialPerPoint: rate,
        loyaltyMinRedeemPoints: min,
      })
      setRateRial(String(res.data.rialsPerPoint))
      setMinRedeem(String(res.data.minRedeemPoints))
      notifySuccess("تنظیمات وفاداری ذخیره شد")
    } catch (error) {
      notifyError("تنظیمات", getApiErrorMessage(error, "ذخیره تنظیمات ناموفق بود"))
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Gift className="h-7 w-7" />
          مدیریت پکیج‌ها و طرح‌ها
        </h1>
        <p className="text-muted-foreground mt-1">
          پکیج جلسات به خدمت سالن وصل است. فروش نقد/کارت در دفتر کل سالن ثبت نمی‌شود؛ کیف پول مشتری جداست.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تنظیمات وفاداری و امتیاز</CardTitle>
          <CardDescription>نرخ تبدیل و حداقل امتیاز از دیتابیس خوانده می‌شود؛ در صورت نبود ردیف، پیش‌فرض ۱۰۰۰ ریال و ۱۰۰ امتیاز است.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="space-y-2">
            <Label>ریال به‌ازای هر امتیاز</Label>
            <Input dir="ltr" value={rateRial} onChange={(e) => setRateRial(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>حداقل امتیاز برای تبدیل</Label>
            <Input dir="ltr" value={minRedeem} onChange={(e) => setMinRedeem(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => void saveLoyaltySettings()}>ذخیره تنظیمات</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "ویرایش پکیج" : "پکیج جدید"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>عنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>خدمت</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {services.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>قیمت (ریال)</Label>
            <Input dir="ltr" value={price} onChange={(e) => setPrice(formatNumberWithCommas(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>تعداد جلسات</Label>
            <Input dir="ltr" value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>اعتبار (روز)</Label>
            <Input dir="ltr" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>امتیاز لازم برای واجد شرایط شدن (اختیاری)</Label>
            <Input dir="ltr" value={pointsRequired} onChange={(e) => setPointsRequired(e.target.value)} placeholder="خالی = فقط فروش نقدی" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>توضیح</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={saving} onClick={() => void saveTemplate()}>
              <Plus className="h-4 w-4 ml-1" />
              {editingId ? "ذخیره" : "ایجاد"}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm}>انصراف</Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>فهرست پکیج‌ها</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.length === 0 ? <p className="text-sm text-muted-foreground">پکیجی نیست.</p> : templates.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.serviceName} · {item.totalSessions} جلسه · {item.validityDays} روز · {formatRials(Number(item.priceRial))}
                  {item.pointsRequired ? ` · ${item.pointsRequired} امتیاز` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.isActive ? "success" : "outline"} className="normal-case tracking-normal">
                  {item.isActive ? "فعال" : "غیرفعال"}
                </Badge>
                <Button type="button" size="sm" variant="outline" onClick={() => {
                  setEditingId(item.id)
                  setTitle(item.title)
                  setDescription(item.description || "")
                  setPrice(formatNumberWithCommas(item.priceRial))
                  setValidityDays(String(item.validityDays))
                  setTotalSessions(String(item.totalSessions))
                  setServiceId(String(item.serviceId))
                  setPointsRequired(item.pointsRequired ? String(item.pointsRequired) : "")
                }}>ویرایش</Button>
                {item.isActive ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => void deactivate(item.id)}>غیرفعال</Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>واگذاری به مشتری</CardTitle>
          <CardDescription>جستجو فقط با دکمه انجام می‌شود.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input placeholder="نام یا موبایل" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => void runSearch()}>
              <Search className="h-4 w-4 ml-1" />
              جستجو
            </Button>
          </div>
          {hits.map((row) => (
            <button
              key={row.id}
              type="button"
              className={`w-full text-right rounded-xl border p-3 text-sm ${selectedCustomer?.id === row.id ? "border-primary bg-primary/10" : "border-border"}`}
              onClick={() => void pickCustomer(row)}
            >
              {row.user?.name} · {row.user?.phone}
            </button>
          ))}
          {selectedCustomer ? (
            <div className="space-y-3 rounded-xl border border-border p-3">
              <p className="text-sm">امتیاز وفاداری: {loyaltyPoints ?? "—"}</p>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={assignTemplateId} onChange={(e) => setAssignTemplateId(e.target.value)}>
                {templates.filter((t) => t.isActive).map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                {PAYMENTS.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <Button type="button" disabled={saving} onClick={() => void assign()}>ثبت پکیج برای مشتری</Button>
              <div className="grid gap-2 md:grid-cols-2">
                <Input dir="ltr" placeholder="تعدیل امتیاز (+/-)" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
                <Input placeholder="توضیح الزامی" value={adjustNotes} onChange={(e) => setAdjustNotes(e.target.value)} />
              </div>
              <Button type="button" variant="outline" onClick={() => void adjustLoyalty()}>ثبت تعدیل امتیاز</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
