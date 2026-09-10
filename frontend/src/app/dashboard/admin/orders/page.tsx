"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, RefreshCw, ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { OrderDetailsPanel } from "@/components/admin/orders/OrderDetailsPanel"
import { OrdersTable } from "@/components/admin/orders/OrdersTable"
import { getCurrentUser } from "@/lib/auth"
import { api } from "@/lib/axios"
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  isOrderStatus,
  shopApiErrorMessage,
  type OrderStatus,
  type ShopOrder,
  type ShopOrderListResponse,
} from "@/lib/orders"
import { getDashboardHomePath } from "@/lib/user-roles"

const PAGE_SIZE = 20

export default function AdminOrdersPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<ShopOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selected, setSelected] = useState<ShopOrder | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser && currentUser.role !== "ADMIN") {
      window.location.href = getDashboardHomePath(currentUser.role)
    }
  }, [])

  const loadList = useCallback(async () => {
    try {
      setLoading(true)
      const params: { page: number; limit: number; status?: OrderStatus } = {
        page,
        limit: PAGE_SIZE,
      }
      if (isOrderStatus(statusFilter)) params.status = statusFilter
      const res = await api.get<ShopOrderListResponse>("/orders", { params })
      const data = res.data
      setOrders(data.orders || [])
      setTotal(data.total || 0)
    } catch (error) {
      toast({
        title: "خطا",
        description: shopApiErrorMessage(error, "بارگذاری سفارشات ناموفق بود"),
        variant: "destructive",
      })
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, toast])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const openOrder = async (row: ShopOrder) => {
    setSelected(row)
    setDetailLoading(true)
    try {
      const res = await api.get<ShopOrder>(`/orders/${row.id}`)
      setSelected(res.data)
    } catch (error) {
      toast({
        title: "خطا",
        description: shopApiErrorMessage(error, "جزئیات سفارش بارگذاری نشد"),
        variant: "destructive",
      })
    } finally {
      setDetailLoading(false)
    }
  }

  const updateStatus = async (payload: {
    status: OrderStatus
    adminNotes?: string
    trackingCode?: string
  }) => {
    if (!selected) return
    setSaving(true)
    try {
      const res = await api.patch<ShopOrder>(`/orders/${selected.id}/status`, payload)
      setSelected(res.data)
      toast({ title: "وضعیت سفارش به‌روز شد" })
      await loadList()
    } catch (error) {
      toast({
        title: "خطا",
        description: shopApiErrorMessage(error, "به‌روزرسانی وضعیت ناموفق بود"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ShoppingBag className="h-6 w-6" />
            سفارشات فروشگاه
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            بررسی رسید کارت‌به‌کارت و به‌روزرسانی وضعیت ارسال
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadList()}>
          <RefreshCw className="h-4 w-4" />
          بازخوانی
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.9fr)]">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle>لیست سفارش‌ها</CardTitle>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setPage(1)
                setStatusFilter(value)
              }}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="همه وضعیت‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                {ORDER_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {ORDER_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-16 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <OrdersTable orders={orders} selectedId={selected?.id} onSelect={openOrder} />
            )}
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                صفحه {page} از {pageCount} — {total} سفارش
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  قبلی
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  بعدی
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>جزئیات</CardTitle>
          </CardHeader>
          <CardContent>
            <OrderDetailsPanel
              order={selected}
              loading={detailLoading}
              saving={saving}
              onUpdateStatus={updateStatus}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
