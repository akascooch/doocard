"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getApiErrorMessage, notifyError } from "@/lib/notify"
import { getCurrentUser } from "@/lib/auth"
import { getDashboardHomePath } from "@/lib/user-roles"
import api from "@/lib/axios"
import { Activity, Database, Loader2, Monitor, RefreshCw, Server, Wifi } from "lucide-react"

type HealthResponse = {
  status: string
  timestamp: string
  timezone?: string
  clientErrorsLast24h?: number
  clientErrorsScope?: string
  services?: {
    database?: { status: string; latencyMs?: number }
    redis?: { status: string; latencyMs?: number }
    cache?: { status: string; note?: string }
  }
  system?: {
    memory?: {
      totalMb?: number
      freeMb?: number
      usedMb?: number
      processRssMb?: number
      processHeapUsedMb?: number
    }
    cpu?: {
      cores?: number
      percentSinceBoot?: number
      processUserMs?: number
      processSystemMs?: number
    }
    uptimeSeconds?: number
    nodeVersion?: string
    platform?: string
  }
}

function statusVariant(status?: string): "success" | "warning" | "destructive" | "outline" {
  if (status === "ok" || status === "healthy") return "success"
  if (status === "degraded" || status === "not_configured" || status === "memory") return "warning"
  if (status === "down" || status === "unhealthy") return "destructive"
  return "outline"
}

function statusFa(status?: string): string {
  switch (status) {
    case "ok":
    case "healthy":
      return "سالم"
    case "degraded":
      return "ناپایدار"
    case "down":
    case "unhealthy":
      return "قطع"
    case "not_configured":
      return "پیکربندی نشده"
    case "memory":
      return "حافظهٔ فرایند"
    default:
      return status || "نامشخص"
  }
}

export default function AdminMonitoringPage() {
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [frontendOk, setFrontendOk] = useState(false)
  const [roundtripMs, setRoundtripMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== "ADMIN") {
      window.location.replace(getDashboardHomePath(currentUser?.role))
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const started = performance.now()
    try {
      const res = await api.get("/monitoring/system-health")
      setRoundtripMs(Math.round(performance.now() - started))
      setHealth(res.data)
      setFrontendOk(true)
    } catch (err) {
      setFrontendOk(false)
      setRoundtripMs(null)
      const message = getApiErrorMessage(err, "خواندن وضعیت سرور ناموفق بود")
      setError(message)
      notifyError("مانیتورینگ", message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const memory = health?.system?.memory
  const cpu = health?.system?.cpu

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7" />
            مانیتورینگ سرور
          </h1>
          <p className="text-muted-foreground mt-1">
            به‌روزرسانی فقط با دکمهٔ دستی انجام می‌شود؛ حلقهٔ polling وجود ندارد.
          </p>
        </div>
        <Button type="button" onClick={() => void refresh()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <RefreshCw className="h-4 w-4 ml-1" />}
          بروزرسانی وضعیت
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              وضعیت سرور (RAM)
            </CardDescription>
            <CardTitle className="text-xl">
              {memory ? `${memory.usedMb} / ${memory.totalMb} MB` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>آزاد: {memory?.freeMb ?? "—"} MB</p>
            <p>RSS فرایند: {memory?.processRssMb ?? "—"} MB</p>
            <p>Heap: {memory?.processHeapUsedMb ?? "—"} MB</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              وضعیت سرور (CPU)
            </CardDescription>
            <CardTitle className="text-xl">
              {cpu ? `${cpu.percentSinceBoot}% · ${cpu.cores} هسته` : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <p>uptime نود: {health?.system?.uptimeSeconds ?? "—"} ثانیه</p>
            <p>{health?.system?.nodeVersion} · {health?.system?.platform}</p>
            <p>خطاهای کلاینت ۲۴س (همین فرایند): {health?.clientErrorsLast24h ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              وضعیت اتصال دیتابیس
            </CardDescription>
            <CardTitle className="text-xl">
              <Badge variant={statusVariant(health?.services?.database?.status)} className="normal-case tracking-normal">
                {statusFa(health?.services?.database?.status)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            تأخیر: {health?.services?.database?.latencyMs ?? "—"} ms
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              وضعیت اتصال Redis
            </CardDescription>
            <CardTitle className="text-xl">
              <Badge variant={statusVariant(health?.services?.redis?.status)} className="normal-case tracking-normal">
                {statusFa(health?.services?.redis?.status)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {health?.services?.redis?.status === "not_configured"
              ? "REDIS_URL / REDIS_HOST تنظیم نشده؛ کش اپ حافظهٔ فرایند است."
              : `تأخیر: ${health?.services?.redis?.latencyMs ?? "—"} ms`}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            وضعیت فرانت‌اند
          </CardDescription>
          <CardTitle className="text-xl">
            <Badge variant={frontendOk ? "success" : "destructive"} className="normal-case tracking-normal">
              {frontendOk ? "متصل به API" : "قطع از API"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>زمان رفت‌وبرگشت همین درخواست: {roundtripMs ?? "—"} ms</p>
          <p>زمان پاسخ سرور: {health?.timestamp ? new Date(health.timestamp).toLocaleString("fa-IR") : "—"}</p>
          <p>وضعیت کلی: {statusFa(health?.status)}</p>
        </CardContent>
      </Card>
    </div>
  )
}
