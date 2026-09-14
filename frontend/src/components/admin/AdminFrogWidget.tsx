"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getApiErrorMessage, notifyError, notifySuccess } from "@/lib/notify"
import api from "@/lib/axios"
import { CheckCircle2, Circle, Loader2, PlayCircle } from "lucide-react"
import Link from "next/link"

type FrogStatus = "PENDING" | "IN_PROGRESS" | "DONE"

type Frog = {
  id: string
  dateKey: string
  title: string
  description: string | null
  status: FrogStatus
  isCompleted: boolean
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

export function AdminFrogWidget() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unauthorized, setUnauthorized] = useState(false)
  const [frog, setFrog] = useState<Frog | null>(null)
  const [rollover, setRollover] = useState<Frog | null>(null)
  const [history, setHistory] = useState<Frog[]>([])
  const [historyPage, setHistoryPage] = useState(1)
  const [historyTotal, setHistoryTotal] = useState(0)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  const load = useCallback(async (page = 1) => {
    setError(null)
    setUnauthorized(false)
    try {
      const [todayRes, historyRes] = await Promise.all([
        api.get("/admin/personal/frog/today"),
        api.get("/admin/personal/frog/history", { params: { page, pageSize: 5 } }),
      ])
      setFrog(todayRes.data.frog)
      setRollover(todayRes.data.rollover)
      if (todayRes.data.frog) {
        setTitle(todayRes.data.frog.title)
        setDescription(todayRes.data.frog.description || "")
      }
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
      const res = await api.post("/admin/personal/frog", fromRollover && rollover
        ? { rolloverId: rollover.id }
        : { title: title.trim(), description: description.trim() || undefined })
      setFrog(res.data)
      setRollover(null)
      setTitle(res.data.title)
      setDescription(res.data.description || "")
      notifySuccess("ذخیره شد", "قورباغه امروز ثبت شد")
      await load(historyPage)
    } catch (err) {
      notifyError("ذخیره ناموفق", getApiErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const toggle = async () => {
    if (!frog || frog.status === "DONE") return
    setSaving(true)
    try {
      const res = await api.patch(`/admin/personal/frog/${frog.id}/toggle`, {})
      setFrog(res.data)
      notifySuccess("وضعیت به‌روز شد", STATUS_LABEL[res.data.status as FrogStatus])
    } catch (err) {
      notifyError("تغییر وضعیت ناموفق", getApiErrorMessage(err))
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

  return (
    <Card className="border-primary/30" data-cy="admin-frog-widget">
      <CardHeader className="space-y-3">
        <Badge variant="warning" className="w-fit normal-case tracking-normal">
          قورباغه امروزت رو قورت بده!
        </Badge>
        <CardTitle className="text-2xl">قورباغه امروز</CardTitle>
        <CardDescription>
          یک کار حیاتی برای امروز. وضعیت فقط جلو می‌رود: در انتظار، در حال انجام، انجام شد.
          {" "}
          <Link href="/dashboard/admin/frog-tasks" className="text-primary underline-offset-4 hover:underline">
            مدیریت کامل و تکرار خودکار
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rollover && !frog ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
            <p className="text-sm text-foreground">
              قورباغه دیروز تمام نشده: <strong>{rollover.title}</strong>
            </p>
            <Button type="button" variant="outline" disabled={saving} onClick={() => void save(true)} data-cy="frog-rollover">
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
              {frog.description ? (
                <p className="text-sm text-muted-foreground break-words">{frog.description}</p>
              ) : null}
              <Badge data-cy="frog-status" variant={frog.status === "DONE" ? "success" : frog.status === "IN_PROGRESS" ? "warning" : "outline"} className="normal-case tracking-normal">
                {STATUS_LABEL[frog.status]}
              </Badge>
            </div>
            <Button type="button" disabled={saving || frog.status === "DONE"} onClick={() => void toggle()} data-cy="frog-toggle">
              {frog.status === "DONE" ? "انجام شد" : "وضعیت بعدی"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">هنوز قورباغه‌ای برای امروز ثبت نشده است.</p>
        )}

        <div className="space-y-2">
          <Input
            data-cy="frog-title"
            placeholder="مهم‌ترین کار امروز چیست؟"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="توضیح کوتاه (اختیاری)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
          <Button type="button" disabled={saving || title.trim().length < 2} onClick={() => void save(false)} data-cy="frog-save">
            {frog ? "به‌روزرسانی قورباغه امروز" : "ثبت قورباغه امروز"}
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
                    {STATUS_LABEL[item.status]} · {item.dateKey}
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
