"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage, notifyError, notifySuccess } from "@/lib/notify"
import api from "@/lib/axios"
import { CheckCircle2, Circle, Clock, Loader2, PlayCircle, Plus, Trash2 } from "lucide-react"
import Link from "next/link"

type FrogStatus = "PENDING" | "IN_PROGRESS" | "DONE"

type Frog = {
  id: string
  dateKey: string
  title: string
  description: string | null
  status: FrogStatus
  isCompleted: boolean
  dueTime?: string
  reminderSent?: boolean
}

const STATUS_LABEL: Record<FrogStatus, string> = {
  PENDING: "در انتظار",
  IN_PROGRESS: "در حال انجام",
  DONE: "انجام شد",
}

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

export function AdminFrogWidget() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [items, setItems] = useState<Frog[]>([])
  const [rollover, setRollover] = useState<Frog | null>(null)
  const [history, setHistory] = useState<Frog[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [dueTime, setDueTime] = useState("09:00")

  const load = useCallback(async (page = 1) => {
    setError(null)
    setUnauthorized(false)
    try {
      const [todayRes, historyRes] = await Promise.all([
        api.get("/admin/personal/frog/today"),
        api.get("/admin/personal/frog/history", { params: { page, pageSize: 5 } }),
      ])
      const dayItems: Frog[] = todayRes.data.items || (todayRes.data.frog ? [todayRes.data.frog] : [])
      setItems(dayItems)
      setRollover(todayRes.data.rollover)
      setHistory(historyRes.data.items || [])
      setHistoryTotal(historyRes.data.total || 0)
      setHistoryPage(historyRes.data.page || page)
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401 || status === 403) {
        setUnauthorized(true)
        setError("این بخش فقط برای مدیر سالن است.")
      } else {
        setError(getApiErrorMessage(err, "بارگذاری ناموفق بود"))
      }
      notifyError("قورباغه امروز", getApiErrorMessage(err, "بارگذاری ناموفق بود"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(1)
  }, [load])

  const save = async (fromRollover = false) => {
    if (!fromRollover && title.trim().length < 2) {
      notifyError("عنوان الزامی است", "حداقل دو نویسه وارد کنید")
      return
    }
    setSaving(true)
    try {
      await api.post("/admin/personal/frog", fromRollover && rollover
        ? { rolloverId: rollover.id }
        : { title: title.trim(), description: description.trim() || undefined, dueTime })
      if (!fromRollover) {
        setTitle("")
        setDescription("")
      }
      notifySuccess("ذخیره شد", "قورباغه ثبت شد")
      await load(historyPage)
    } catch (err) {
      notifyError("ذخیره ناموفق", getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (frog: Frog) => {
    if (frog.status === "DONE") return
    setSaving(true)
    try {
      await api.patch(`/admin/personal/frog/${frog.id}/toggle`, {})
      notifySuccess("وضعیت به‌روز شد", STATUS_LABEL[frog.status === "PENDING" ? "IN_PROGRESS" : "DONE"])
      await load(historyPage)
    } catch (err) {
      notifyError("تغییر وضعیت ناموفق", getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setSaving(true)
    try {
      await api.delete(`/admin/personal/frog/${id}`)
      notifySuccess("حذف شد", "قورباغه از لیست امروز برداشته شد")
      await load(historyPage)
    } catch (err) {
      notifyError("حذف ناموفق", getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>قورباغه امروز</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          {!unauthorized ? (
            <Button type="button" variant="outline" onClick={() => { setLoading(true); void load(1) }}>
              تلاش دوباره
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  const historyPages = Math.max(1, Math.ceil(historyTotal / 5))
  const firstOpen = items.find((item) => item.status !== "DONE") || items[0] || null

  return (
    <Card className="border-primary/30" data-cy="admin-frog-widget">
      <CardHeader className="space-y-3">
        <Badge variant="warning" className="w-fit normal-case tracking-normal">
          قورباغه امروزت رو قورت بده!
        </Badge>
        <CardTitle className="text-2xl">قورباغه امروز</CardTitle>
        <CardDescription>
          چند کار حیاتی برای امروز، با ساعت انجام. یادآوری پیامکی حدود ۲ ساعت قبل از موعد ارسال می‌شود.
          {" "}
          <Link href="/dashboard/admin/frog-tasks" className="text-primary underline-offset-4 hover:underline">
            مدیریت کامل و تکرار خودکار
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rollover && items.length === 0 ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <p className="text-sm text-foreground">
              قورباغه دیروز تمام نشده: <strong>{rollover.title}</strong>
            </p>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)} data-cy="frog-rollover">
              انتقال به امروز
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">هنوز قورباغه‌ای برای امروز ثبت نشده است.</p>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {items.map((item) => {
              const isPrimary = firstOpen?.id === item.id
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                  data-cy="frog-item"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={item.status} />
                      <p className={`font-semibold break-words ${item.isCompleted ? "line-through text-muted-foreground" : ""}`}>
                        {item.title}
                      </p>
                    </div>
                    {item.description ? (
                      <p className="text-sm text-muted-foreground break-words">{item.description}</p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        data-cy={isPrimary ? "frog-status" : undefined}
                        variant={statusBadgeVariant(item.status)}
                        className="normal-case tracking-normal"
                      >
                        {STATUS_LABEL[item.status]}
                      </Badge>
                      <Badge variant="outline" className="normal-case tracking-normal gap-1">
                        <Clock className="h-3 w-3" />
                        {item.dueTime || "—"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      disabled={saving || item.status === "DONE"}
                      onClick={() => void toggle(item)}
                      data-cy={isPrimary ? "frog-toggle" : undefined}
                    >
                      {item.status === "DONE" ? "انجام شد" : "وضعیت بعدی"}
                    </Button>
                    <Button type="button" variant="ghost" size="icon" disabled={saving} onClick={() => void remove(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="space-y-2">
          <Input
            data-cy="frog-title"
            placeholder="عنوان قورباغه جدید"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="space-y-1">
            <Label htmlFor="widget-frog-due-time">ساعت انجام</Label>
            <Input
              id="widget-frog-due-time"
              type="time"
              dir="ltr"
              className="text-center"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value.slice(0, 5))}
            />
          </div>
          <Textarea
            placeholder="توضیح کوتاه (اختیاری)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Button type="button" disabled={saving || title.trim().length < 2 || !dueTime} onClick={() => void save(false)} data-cy="frog-save">
            <Plus className="h-4 w-4 ml-1" />
            افزودن قورباغه
          </Button>
        </div>

        <div className="border-t border-border pt-4 space-y-3" data-cy="frog-history">
          <p className="text-sm font-medium">تاریخچه روزهای قبل</p>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">تاریخچه‌ای نیست.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm" data-cy="frog-history-item" data-date-key={item.dateKey}>
                  <span className="truncate">{item.title}</span>
                  <Badge variant="outline" className="shrink-0 normal-case tracking-normal">
                    {STATUS_LABEL[item.status]} · {item.dateKey}{item.dueTime ? ` · ${item.dueTime}` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {historyTotal > 5 ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={historyPage <= 1}
                onClick={() => void load(historyPage - 1)}
              >
                قبلی
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={historyPage >= historyPages}
                onClick={() => void load(historyPage + 1)}
              >
                بعدی
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
