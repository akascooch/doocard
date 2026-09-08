"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import MoneyInput from "@/components/ui/MoneyInput"
import { useToast } from "@/components/ui/use-toast"
import { getCurrentUser } from "@/lib/auth"
import { getDashboardHomePath } from "@/lib/user-roles"
import { api } from "@/lib/axios"
import { formatToJalali } from "@/lib/date"
import { formatTomansFromRial } from "@/lib/money"
import { ArrowRight, Package, TriangleAlert } from "lucide-react"

interface InventorySummaryItem {
  id: number
  name: string
  sku: string | null
  stock: number
  lowStockAlert: number | null
  isActive: boolean
  isLowStock: boolean
  lastMovement: {
    type: string
    quantity: number
    createdAt: string
  } | null
}

interface MovementRow {
  id: number
  type: string
  quantity: number
  unitCostRial: string | null
  reason: string | null
  createdAt: string
  performedBy: { id: number; name: string } | null
}

function apiErrorMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { message_fa?: string; message?: string | string[] } } })
    ?.response?.data
  if (typeof data?.message_fa === "string") return data.message_fa
  if (typeof data?.message === "string") return data.message
  if (Array.isArray(data?.message)) return data.message[0]
  return fallback
}

const TYPE_LABEL: Record<string, string> = {
  IN: "ورود",
  OUT: "خروج",
  ADJUSTMENT: "اصلاح",
  APPOINTMENT_SALE: "فروش نوبت",
  REVERSAL: "برگشت",
}

export default function AdminInventoryPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<InventorySummaryItem[]>([])
  const [selectedId, setSelectedId] = useState<number | "">("")
  const [movements, setMovements] = useState<MovementRow[]>([])
  const [type, setType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN")
  const [quantity, setQuantity] = useState(1)
  const [unitCostRial, setUnitCostRial] = useState(0)
  const [reason, setReason] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser && currentUser.role !== "ADMIN") {
      window.location.href = getDashboardHomePath(currentUser.role)
      return
    }
    void loadSummary()
  }, [])

  const loadSummary = async () => {
    try {
      setLoading(true)
      const res = await api.get("/products/inventory/summary")
      setSummary(res.data || [])
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "خطا در بارگذاری موجودی"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const loadMovements = async (id: number) => {
    const res = await api.get(`/products/${id}/movements`, { params: { limit: 50 } })
    setMovements(res.data.data || [])
  }

  const selected = useMemo(
    () => summary.find((p) => p.id === selectedId) || null,
    [summary, selectedId],
  )

  const lowStockItems = summary.filter((p) => p.isLowStock && p.isActive)

  const handleSelect = async (id: number) => {
    setSelectedId(id)
    try {
      await loadMovements(id)
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "خطا در بارگذاری حرکات"),
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async () => {
    if (!selectedId) {
      toast({ title: "خطا", description: "ابتدا محصول را انتخاب کنید", variant: "destructive" })
      return
    }
    try {
      setSaving(true)
      await api.post(`/products/${selectedId}/movements`, {
        type,
        quantity,
        unitCostRial: type === "IN" && unitCostRial > 0 ? unitCostRial : undefined,
        reason: reason.trim() || undefined,
      })
      toast({ title: "موفق", description: "حرکت موجودی ثبت شد" })
      setReason("")
      await Promise.all([loadSummary(), loadMovements(Number(selectedId))])
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "ثبت حرکت ناموفق بود"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">موجودی انبار</h1>
          <p className="mt-2 text-muted-foreground">ورود، خروج و اصلاح موجودی محصولات</p>
        </div>
        <Link href="/dashboard/admin/products">
          <Button variant="outline">
            <ArrowRight className="ml-2 h-4 w-4" />
            کاتالوگ محصولات
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>تعداد کالا</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>هشدار موجودی کم</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600">{lowStockItems.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>کالاهای فعال</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.filter((p) => p.isActive).length}
          </CardContent>
        </Card>
      </div>

      {lowStockItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-red-600" />
              موجودی پایین
            </CardTitle>
            <CardDescription>کالاهایی که به سقف هشدار رسیده‌اند</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {lowStockItems.map((item) => (
              <Badge key={item.id} variant="destructive">
                {item.name}: {item.stock}
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>ثبت حرکت</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>محصول</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={selectedId}
              onChange={(e) => {
                const id = Number(e.target.value)
                if (id) void handleSelect(id)
                else setSelectedId("")
              }}
            >
              <option value="">انتخاب محصول</option>
              {summary.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — موجودی {p.stock}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>نوع</Label>
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as "IN" | "OUT" | "ADJUSTMENT")}
            >
              <option value="IN">ورود</option>
              <option value="OUT">خروج</option>
              <option value="ADJUSTMENT">اصلاح (موجودی مطلق)</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>{type === "ADJUSTMENT" ? "موجودی جدید" : "تعداد"}</Label>
            <Input
              type="number"
              min={type === "ADJUSTMENT" ? 0 : 1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value) || 0)}
            />
          </div>
          {type === "IN" && (
            <MoneyInput
              value={unitCostRial}
              onChange={setUnitCostRial}
              label="بهای تمام‌شده واحد (اختیاری)"
            />
          )}
          <div className="space-y-2 md:col-span-2">
            <Label>علت</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {selected && (
            <p className="text-sm text-muted-foreground md:col-span-2">
              موجودی فعلی {selected.name}: {selected.stock}
            </p>
          )}
          <div className="md:col-span-2">
            <Button
              className="doocard-gradient hover:opacity-90"
              disabled={saving || !selectedId}
              onClick={() => void handleSubmit()}
            >
              ثبت حرکت
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            تاریخچه حرکات
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2 font-medium">نوع</th>
                <th className="p-2 font-medium">تعداد</th>
                <th className="p-2 font-medium">بهای واحد</th>
                <th className="p-2 font-medium">علت</th>
                <th className="p-2 font-medium">ثبت‌کننده</th>
                <th className="p-2 font-medium">تاریخ</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="p-2">
                    <Badge
                      variant={
                        row.type === "OUT"
                          ? "destructive"
                          : row.type === "IN"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {TYPE_LABEL[row.type] || row.type}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono">{row.quantity}</td>
                  <td className="p-2">
                    {row.unitCostRial ? formatTomansFromRial(row.unitCostRial) : "—"}
                  </td>
                  <td className="p-2">{row.reason || "—"}</td>
                  <td className="p-2">{row.performedBy?.name || "—"}</td>
                  <td className="p-2">{formatToJalali(row.createdAt, "YYYY/MM/DD HH:mm")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedId && movements.length === 0 && (
            <div className="py-10 text-center text-muted-foreground">حرکتی ثبت نشده است</div>
          )}
          {!selectedId && (
            <div className="py-10 text-center text-muted-foreground">محصول را انتخاب کنید</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
