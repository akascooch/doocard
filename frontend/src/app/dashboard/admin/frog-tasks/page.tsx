"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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
import { getApiErrorMessage, notifyError, notifySuccess } from "@/lib/notify"
import { getCurrentUser } from "@/lib/auth"
import { getDashboardHomePath } from "@/lib/user-roles"
import api from "@/lib/axios"
import { CheckCircle2, Circle, Loader2, PlayCircle, Plus, Target, Trash2 } from "lucide-react"

type FrogStatus = "PENDING" | "IN_PROGRESS" | "DONE"

type Frog = {
  id: string
  dateKey: string
  title: string
  description: string | null
  status: FrogStatus
  isCompleted: boolean
}

type Recurrence = {
  id: string
  title: string
  description: string | null
  frequency: "DAILY" | "WEEKLY"
  dayOfWeek: number | null
  isActive: boolean
  lastRunAt: string | null
}

const STATUS_LABEL: Record<FrogStatus, string> = {
  PENDING: "در انتظار",
  IN_PROGRESS: "در حال انجام",
  DONE: "انجام شد",
}

const WEEKDAY_LABELS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"]

function StatusIcon({ status }: { status: FrogStatus }) {
  if (status === "DONE") return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === "IN_PROGRESS") return <PlayCircle className="h-5 w-5 text-amber-500" />
  return <Circle className="h-5 w-5 text-muted-foreground" />
}

export default function AdminFrogTasksPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [todayKey, setTodayKey] = useState("")
  const [frog, setFrog] = useState<Frog | null>(null)
  const [rollover, setRollover] = useState<Frog | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [recurrences, setRecurrences] = useState<Recurrence[]>([])
  const [ruleTitle, setRuleTitle] = useState("")
  const [ruleDescription, setRuleDescription] = useState("")
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY">("DAILY")
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [history, setHistory] = useState<Frog[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== "ADMIN") {
      window.location.replace(getDashboardHomePath(currentUser?.role))
    }
  }, [])

  const loadToday = useCallback(async () => {
    const res = await api.get("/admin/personal/frog/today")
    setTodayKey(res.data.today || "")
    setFrog(res.data.frog || null)
    setRollover(res.data.rollover || null)
    if (res.data.frog) {
      setTitle(res.data.frog.title)
      setDescription(res.data.frog.description || "")
    }
  }, [])

  const loadRecurrences = useCallback(async () => {
    const res = await api.get("/admin/personal/frog/recurrences")
    setRecurrences(res.data.items || [])
  }, [])

  const loadHistory = useCallback(async (page = 1) => {
    const res = await api.get("/admin/personal/frog/history", { params: { page, pageSize } })
    setHistory(res.data.items || [])
    setHistoryTotal(res.data.total || 0)
    setHistoryPage(res.data.page || page)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([loadToday(), loadRecurrences(), loadHistory(1)])
    } catch (error) {
      notifyError("قورباغه", getApiErrorMessage(error, "بارگذاری ناموفق بود"))
    } finally {
      setLoading(false)
    }
  }, [loadToday, loadRecurrences, loadHistory])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const saveToday = async (fromRollover = false) => {
    setSaving(true)
    try {
      await api.post("/admin/personal/frog", fromRollover && rollover
        ? { rolloverId: rollover.id }
        : { title: title.trim(), description: description.trim() || undefined })
      notifySuccess("قورباغه امروز ذخیره شد")
      await loadToday()
    } catch (error) {
      notifyError("قورباغه", getApiErrorMessage(error, "ذخیره ناموفق بود"))
    } finally {
      setSaving(false)
    }
  }

  const toggleToday = async () => {
    if (!frog || frog.status === "DONE") return
    setSaving(true)
    try {
      const res = await api.patch(`/admin/personal/frog/${frog.id}/toggle`, {})
      setFrog(res.data)
      notifySuccess("وضعیت به‌روز شد")
    } catch (error) {
      notifyError("قورباغه", getApiErrorMessage(error, "تغییر وضعیت ناموفق بود"))
    } finally {
      setSaving(false)
    }
  }

  const createRule = async () => {
    if (ruleTitle.trim().length < 2) return
    setSaving(true)
    try {
      await api.post("/admin/personal/frog/recurrences", {
        title: ruleTitle.trim(),
        description: ruleDescription.trim() || undefined,
        frequency,
        ...(frequency === "WEEKLY" ? { dayOfWeek } : {}),
      })
      setRuleTitle("")
      setRuleDescription("")
      notifySuccess("الگوی تکرار ثبت شد")
      await loadRecurrences()
    } catch (error) {
      notifyError("الگو", getApiErrorMessage(error, "ثبت الگو ناموفق بود"))
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (item: Recurrence) => {
    try {
      await api.patch(`/admin/personal/frog/recurrences/${item.id}`, { isActive: !item.isActive })
      await loadRecurrences()
    } catch (error) {
      notifyError("الگو", getApiErrorMessage(error, "تغییر وضعیت الگو ناموفق بود"))
    }
  }

  const removeRule = async () => {
    if (!deleteId) return
    try {
      await api.delete(`/admin/personal/frog/recurrences/${deleteId}`)
      setDeleteId(null)
      notifySuccess("الگو حذف شد")
      await loadRecurrences()
    } catch (error) {
      notifyError("الگو", getApiErrorMessage(error, "حذف ناموفق بود"))
    }
  }

  const historyPages = Math.max(1, Math.ceil(historyTotal / pageSize))

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
          <Target className="h-7 w-7" />
          مدیریت قورباغه (تمرکز روز)
        </h1>
        <p className="text-muted-foreground mt-1">
          حداکثر یک قورباغه در هر روز تقویم تهران. الگوهای تکرار فقط وقتی ردیف امروز خالی باشد ایجاد می‌شوند.
        </p>
        <Link href="/dashboard/admin" className="text-sm text-primary mt-2 inline-block">
          بازگشت به داشبورد
        </Link>
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle>قورباغه امروز</CardTitle>
          <CardDescription>تاریخ تهران: {todayKey || "—"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rollover && !frog ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <p className="text-sm">قورباغه دیروز تمام نشده: <strong>{rollover.title}</strong></p>
              <Button type="button" variant="outline" disabled={saving} onClick={() => void saveToday(true)}>
                انتقال به امروز
              </Button>
            </div>
          ) : null}

          {frog ? (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <StatusIcon status={frog.status} />
                  <p className={`font-semibold break-words ${frog.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                    {frog.title}
                  </p>
                </div>
                {frog.description ? <p className="text-sm text-muted-foreground break-words">{frog.description}</p> : null}
                <Badge variant={frog.status === "DONE" ? "success" : frog.status === "IN_PROGRESS" ? "warning" : "outline"} className="normal-case tracking-normal">
                  {STATUS_LABEL[frog.status]}
                </Badge>
              </div>
              <Button type="button" disabled={saving || frog.status === "DONE"} onClick={() => void toggleToday()}>
                {frog.status === "DONE" ? "انجام شد" : "وضعیت بعدی"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">هنوز قورباغه‌ای برای امروز ثبت نشده است.</p>
          )}

          <div className="space-y-2">
            <Label>عنوان</Label>
            <Input placeholder="مهم‌ترین کار امروز چیست؟" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="توضیح کوتاه (اختیاری)" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            <Button type="button" disabled={saving || title.trim().length < 2} onClick={() => void saveToday(false)}>
              {frog ? "به‌روزرسانی قورباغه امروز" : "ثبت قورباغه امروز"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تکرار خودکار (الگوها)</CardTitle>
          <CardDescription>کرون ساعت ۰۴:۰۰ تهران؛ اگر قورباغه امروز وجود داشته باشد چیزی اضافه نمی‌شود.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>عنوان الگو</Label>
              <Input value={ruleTitle} onChange={(e) => setRuleTitle(e.target.value)} placeholder="مثلاً مرور صندوق" />
            </div>
            <div className="space-y-2">
              <Label>نوع تکرار</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as "DAILY" | "WEEKLY")}
              >
                <option value="DAILY">روزانه</option>
                <option value="WEEKLY">هفتگی</option>
              </select>
            </div>
            {frequency === "WEEKLY" ? (
              <div className="space-y-2">
                <Label>روز هفته</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                >
                  {WEEKDAY_LABELS.map((label, index) => (
                    <option key={label} value={index}>{label}</option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-2 md:col-span-2">
              <Label>توضیح (اختیاری)</Label>
              <Textarea value={ruleDescription} onChange={(e) => setRuleDescription(e.target.value)} rows={2} />
            </div>
          </div>
          <Button type="button" disabled={saving || ruleTitle.trim().length < 2} onClick={() => void createRule()}>
            <Plus className="h-4 w-4 ml-1" />
            افزودن الگو
          </Button>

          {recurrences.length === 0 ? (
            <p className="text-sm text-muted-foreground">الگویی ثبت نشده است.</p>
          ) : (
            <ul className="space-y-2">
              {recurrences.map((item) => (
                <li key={item.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium break-words">{item.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.frequency === "DAILY" ? "روزانه" : `هفتگی · ${WEEKDAY_LABELS[item.dayOfWeek ?? 0]}`}
                      {item.lastRunAt ? ` · آخرین اجرا ${new Date(item.lastRunAt).toLocaleString("fa-IR")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={item.isActive ? "success" : "outline"} className="normal-case tracking-normal">
                      {item.isActive ? "فعال" : "غیرفعال"}
                    </Badge>
                    <Button type="button" variant="outline" size="sm" onClick={() => void toggleRule(item)}>
                      {item.isActive ? "غیرفعال" : "فعال"}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteId(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تاریخچه تسک‌ها</CardTitle>
          <CardDescription>روزهای قبل از امروز تهران</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">تاریخچه‌ای نیست.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm rounded-xl border border-border p-3">
                  <span className="truncate">{item.title}</span>
                  <Badge variant="outline" className="shrink-0 normal-case tracking-normal">
                    {STATUS_LABEL[item.status]} · {item.dateKey}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {historyTotal > pageSize ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={historyPage <= 1} onClick={() => void loadHistory(historyPage - 1)}>
                قبلی
              </Button>
              <Button type="button" variant="outline" disabled={historyPage >= historyPages} onClick={() => void loadHistory(historyPage + 1)}>
                بعدی
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deleteId)} onOpenChange={(open) => { if (!open) setDeleteId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الگوی تکرار؟</AlertDialogTitle>
            <AlertDialogDescription>قورباغه‌های ثبت‌شده قبلی حذف نمی‌شوند. فقط الگوی آینده حذف می‌شود.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeRule()}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
