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
import { CheckCircle2, Circle, Clock, Loader2, PlayCircle, Plus, Target, Trash2 } from "lucide-react"
import PersianDatePicker from "@/components/ui/PersianDatePicker"
import { getTehranTodayJalali, persianToEnglishDigits } from "@/lib/date"

type FrogStatus = "PENDING" | "IN_PROGRESS" | "DONE"

type Frog = {
  id: string
  dateKey: string
  title: string
  description: string | null
  status: FrogStatus
  isCompleted: boolean
  dueTime?: string
  scheduledAt?: string
  reminderSent?: boolean
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

function statusBadgeVariant(status: FrogStatus) {
  if (status === "DONE") return "success" as const
  if (status === "IN_PROGRESS") return "warning" as const
  return "outline" as const
}

export default function AdminFrogTasksPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [calendarToday, setCalendarToday] = useState("")
  const [selectedDate, setSelectedDate] = useState("")
  const [items, setItems] = useState<Frog[]>([])
  const [rollover, setRollover] = useState<Frog | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueTime, setDueTime] = useState("09:00")
  const [recurrences, setRecurrences] = useState<Recurrence[]>([])
  const [ruleTitle, setRuleTitle] = useState("")
  const [ruleDescription, setRuleDescription] = useState("")
  const [frequency, setFrequency] = useState<"DAILY" | "WEEKLY">("DAILY")
  const [dayOfWeek, setDayOfWeek] = useState(1)
  const [history, setHistory] = useState<Frog[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [deleteFrogId, setDeleteFrogId] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== "ADMIN") {
      window.location.replace(getDashboardHomePath(currentUser?.role))
    }
  }, [])

  const applyDayPayload = (data: {
    today?: string
    items?: Frog[]
    frog?: Frog | null
    rollover?: Frog | null
  }, markCalendarToday: boolean) => {
    const dateKey = data.today || ""
    if (markCalendarToday) setCalendarToday(dateKey)
    setSelectedDate(dateKey)
    const dayItems = data.items || (data.frog ? [data.frog] : [])
    setItems(dayItems)
    setRollover(data.rollover || null)
  }

  const loadDay = useCallback(async (dateKey?: string, markCalendarToday = false) => {
    const res = dateKey
      ? await api.get("/admin/personal/frog", { params: { dateKey } })
      : await api.get("/admin/personal/frog/today")
    applyDayPayload(res.data, markCalendarToday || !dateKey)
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
      await Promise.all([loadDay(undefined, true), loadRecurrences(), loadHistory(1)])
    } catch (error) {
      notifyError("قورباغه", getApiErrorMessage(error, "بارگذاری ناموفق بود"))
    } finally {
      setLoading(false)
    }
  }, [loadDay, loadRecurrences, loadHistory])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const isViewingToday = Boolean(selectedDate) && selectedDate === calendarToday

  const saveTask = async (fromRollover = false) => {
    if (!fromRollover && title.trim().length < 2) return
    setSaving(true)
    try {
      await api.post("/admin/personal/frog", fromRollover && rollover
        ? { rolloverId: rollover.id }
        : {
            title: title.trim(),
            description: description.trim() || undefined,
            dateKey: selectedDate || undefined,
            dueTime,
          })
      notifySuccess(fromRollover ? "قورباغه دیروز به امروز منتقل شد" : "قورباغه ثبت شد")
      if (!fromRollover) {
        setTitle("")
        setDescription("")
      }
      await loadDay(selectedDate || undefined, false)
      await loadHistory(historyPage)
    } catch (error) {
      notifyError("قورباغه", getApiErrorMessage(error, "ذخیره ناموفق بود"))
    } finally {
      setSaving(false)
    }
  }

  const toggleTask = async (frog: Frog) => {
    if (frog.status === "DONE") return
    setSaving(true)
    try {
      await api.patch(`/admin/personal/frog/${frog.id}/toggle`, {})
      notifySuccess("وضعیت به‌روز شد")
      await loadDay(selectedDate || undefined, false)
    } catch (error) {
      notifyError("قورباغه", getApiErrorMessage(error, "تغییر وضعیت ناموفق بود"))
    } finally {
      setSaving(false)
    }
  }

  const removeTask = async () => {
    if (!deleteFrogId) return
    try {
      await api.delete(`/admin/personal/frog/${deleteFrogId}`)
      setDeleteFrogId(null)
      notifySuccess("قورباغه حذف شد")
      await loadDay(selectedDate || undefined, false)
      await loadHistory(historyPage)
    } catch (error) {
      notifyError("قورباغه", getApiErrorMessage(error, "حذف ناموفق بود"))
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
    if (!deleteRuleId) return
    try {
      await api.delete(`/admin/personal/frog/recurrences/${deleteRuleId}`)
      setDeleteRuleId(null)
      notifySuccess("الگو حذف شد")
      await loadRecurrences()
    } catch (error) {
      notifyError("الگو", getApiErrorMessage(error, "حذف ناموفق بود"))
    }
  }

  const historyPages = Math.max(1, Math.ceil(historyTotal / pageSize))
  const pendingCount = items.filter((item) => !item.isCompleted).length

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
          مدیریت قورباغه
        </h1>
        <p className="text-muted-foreground mt-1">
          چند تسک در هر روز، با ساعت مشخص. پیامک یادآوری حدود ۲ ساعت قبل از موعد به شماره مدیر ارسال می‌شود.
        </p>
        <Link href="/dashboard/admin" className="text-sm text-primary mt-2 inline-block">
          بازگشت به داشبورد
        </Link>
      </div>

      <Card className="border-primary/30">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>لیست قورباغه‌ها</CardTitle>
              <CardDescription>
                {isViewingToday ? "امروز تهران" : "روز انتخاب‌شده"}: {selectedDate || "—"}
                {items.length > 0 ? ` · ${pendingCount} مورد باز از ${items.length}` : ""}
              </CardDescription>
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <PersianDatePicker
                label="تاریخ"
                value={selectedDate ? selectedDate.replace(/-/g, "/") : ""}
                minDate={getTehranTodayJalali() || undefined}
                onChange={(date) => {
                  const next = persianToEnglishDigits(date).replace(/\//g, "-")
                  setSelectedDate(next)
                  if (/^\d{4}-\d{2}-\d{2}$/.test(next)) void loadDay(next, false)
                }}
                placeholder="انتخاب تاریخ شمسی"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {rollover && items.length === 0 ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
              <p className="text-sm">قورباغه دیروز تمام نشده: <strong>{rollover.title}</strong></p>
              <Button type="button" variant="outline" disabled={saving} onClick={() => void saveTask(true)}>
                انتقال به امروز
              </Button>
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">برای این روز هنوز قورباغه‌ای ثبت نشده است.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={item.status} />
                      <p className={`font-semibold break-words ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                        {item.title}
                      </p>
                    </div>
                    {item.description ? <p className="text-sm text-muted-foreground break-words">{item.description}</p> : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusBadgeVariant(item.status)} className="normal-case tracking-normal">
                        {STATUS_LABEL[item.status]}
                      </Badge>
                      <Badge variant="outline" className="normal-case tracking-normal gap-1">
                        <Clock className="h-3 w-3" />
                        {item.dueTime || "—"}
                      </Badge>
                      {item.reminderSent ? (
                        <Badge variant="secondary" className="normal-case tracking-normal">یادآوری ارسال شد</Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button type="button" disabled={saving || item.status === "DONE"} onClick={() => void toggleTask(item)}>
                      {item.status === "DONE" ? "انجام شد" : "وضعیت بعدی"}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteFrogId(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 md:grid-cols-2 rounded-xl border border-dashed border-primary/30 p-4">
            <div className="space-y-2 md:col-span-2">
              <Label>عنوان تسک جدید</Label>
              <Input placeholder="مثلاً تماس با تامین‌کننده" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frog-due-time">ساعت انجام</Label>
              <Input
                id="frog-due-time"
                type="time"
                dir="ltr"
                className="text-center"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value.slice(0, 5))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>توضیح (اختیاری)</Label>
              <Textarea placeholder="جزئیات کوتاه" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="md:col-span-2">
              <Button type="button" disabled={saving || title.trim().length < 2 || !dueTime} onClick={() => void saveTask(false)}>
                <Plus className="h-4 w-4 ml-1" />
                افزودن قورباغه
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تکرار خودکار (الگوها)</CardTitle>
          <CardDescription>
            کرون ساعت ۰۴:۰۰ تهران برای هر الگوی فعال یک تسک با ساعت ۰۹:۰۰ می‌سازد؛ وجود تسک‌های دیگر مانع ایجاد نمی‌شود.
          </CardDescription>
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
                    <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteRuleId(item.id)}>
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
                    {STATUS_LABEL[item.status]} · {item.dateKey}{item.dueTime ? ` · ${item.dueTime}` : ""}
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

      <AlertDialog open={Boolean(deleteRuleId)} onOpenChange={(open) => { if (!open) setDeleteRuleId(null) }}>
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

      <AlertDialog open={Boolean(deleteFrogId)} onOpenChange={(open) => { if (!open) setDeleteFrogId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف این قورباغه؟</AlertDialogTitle>
            <AlertDialogDescription>این تسک از لیست حذف می‌شود و یادآوری پیامکی برای آن ارسال نخواهد شد.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeTask()}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
