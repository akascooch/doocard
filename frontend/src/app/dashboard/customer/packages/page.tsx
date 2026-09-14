"use client"

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getApiErrorMessage, notifyError, notifySuccess } from "@/lib/notify"
import { formatRials } from "@/lib/money"
import { getCurrentUser } from "@/lib/auth"
import { getDashboardHomePath } from "@/lib/user-roles"
import api from "@/lib/axios"
import { Gift, Loader2, Wallet } from "lucide-react"

type OwnedPackage = {
  id: string
  title: string | null
  serviceName: string | null
  totalSessions: number
  remainingSessions: number
  expiresAt: string
  status: string
  expiringSoon?: boolean
}

type Loyalty = {
  points: number
  walletRial: string
  minRedeemPoints: number
  rialsPerPoint: number
  redeemable: boolean
  previewRial: string
}

const STATUS_FA: Record<string, string> = {
  ACTIVE: "فعال",
  EXHAUSTED: "تمام‌شده",
  EXPIRED: "منقضی",
  CANCELLED: "لغو",
}

export default function CustomerPackagesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [packages, setPackages] = useState<OwnedPackage[]>([])
  const [loyalty, setLoyalty] = useState<Loyalty | null>(null)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== "CUSTOMER") {
      window.location.replace(getDashboardHomePath(currentUser?.role))
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pkg, loy] = await Promise.all([
        api.get("/packages/my-packages"),
        api.get("/loyalty/me"),
      ])
      setPackages(pkg.data.items || [])
      setLoyalty(loy.data)
    } catch (error) {
      notifyError("پکیج", getApiErrorMessage(error, "بارگذاری ناموفق بود"))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const redeem = async () => {
    if (!loyalty?.redeemable) return
    setSaving(true)
    try {
      await api.post("/loyalty/redeem-to-wallet", { points: loyalty.points })
      notifySuccess("امتیاز به اعتبار کیف پول تبدیل شد")
      await load()
    } catch (error) {
      notifyError("وفاداری", getApiErrorMessage(error, "تبدیل ناموفق بود"))
    } finally {
      setSaving(false)
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
          پکیج‌ها و امتیاز وفاداری
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            امتیاز و کیف پول
          </CardTitle>
          <CardDescription>
            هر امتیاز = {loyalty ? formatRials(loyalty.rialsPerPoint) : "—"} · حداقل تبدیل {loyalty?.minRedeemPoints ?? 100} امتیاز
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-2xl font-bold">{loyalty?.points ?? 0} امتیاز</p>
          <p className="text-sm text-muted-foreground">اعتبار کیف پول: {loyalty ? formatRials(Number(loyalty.walletRial)) : "—"}</p>
          {loyalty?.redeemable ? (
            <p className="text-sm">پیش‌نمایش تبدیل کل امتیاز: {formatRials(Number(loyalty.previewRial))}</p>
          ) : (
            <p className="text-sm text-muted-foreground">برای تبدیل، حداقل {loyalty?.minRedeemPoints ?? 100} امتیاز لازم است.</p>
          )}
          <Button type="button" disabled={saving || !loyalty?.redeemable} onClick={() => void redeem()}>
            تبدیل امتیاز به اعتبار کیف پول
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>پکیج‌های من</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {packages.length === 0 ? (
            <p className="text-sm text-muted-foreground">پکیج فعالی ندارید.</p>
          ) : packages.map((item) => (
            <div key={item.id} className="rounded-xl border border-border p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{item.title || "پکیج"}</p>
                <Badge variant={item.status === "ACTIVE" ? "success" : "outline"} className="normal-case tracking-normal">
                  {STATUS_FA[item.status] || item.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {item.serviceName} · باقی‌مانده {item.remainingSessions} از {item.totalSessions} جلسه
              </p>
              <p className={`text-sm ${item.expiringSoon ? "text-amber-600" : "text-muted-foreground"}`}>
                انقضا: {new Date(item.expiresAt).toLocaleDateString("fa-IR")}
                {item.expiringSoon ? " · نزدیک به انقضا" : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
