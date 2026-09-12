"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import MoneyInput from "@/components/ui/MoneyInput"
import { formatToJalali } from "@/lib/date"
import { formatTomansFromRial } from "@/lib/money"
import {
  isAwaitingQuote,
  isOrderStatus,
  ORDER_STATUS_BADGE_CLASS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type ShopOrder,
} from "@/lib/orders"

const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  AWAITING_QUOTE: ["PENDING_VERIFICATION", "PROCESSING", "CANCELLED"],
  PENDING_VERIFICATION: ["PAID", "PROCESSING", "CANCELLED"],
  PAID: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
}

export function OrderDetailsPanel({
  order,
  loading,
  saving,
  onUpdateStatus,
}: {
  order: ShopOrder | null
  loading: boolean
  saving: boolean
  onUpdateStatus: (payload: {
    status: OrderStatus
    adminNotes?: string
    trackingCode?: string
    quotedTotalRial?: number
  }) => Promise<void>
}) {
  const [adminNotes, setAdminNotes] = useState("")
  const [trackingCode, setTrackingCode] = useState("")
  const [quotedTotalRial, setQuotedTotalRial] = useState(0)

  useEffect(() => {
    setAdminNotes(order?.adminNotes || "")
    setTrackingCode(order?.trackingCode || "")
    setQuotedTotalRial(0)
  }, [order?.id, order?.adminNotes, order?.trackingCode])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!order) {
    return <p className="py-8 text-sm text-muted-foreground">یک سفارش را از جدول انتخاب کنید.</p>
  }

  const status = isOrderStatus(order.status) ? order.status : "PENDING_VERIFICATION"
  const quotePending = isAwaitingQuote(status)
  const nextStatuses = STATUS_TRANSITIONS[status]

  return (
    <div className="space-y-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{order.orderNumber}</p>
          <p className="text-muted-foreground">
            {formatToJalali(order.createdAt, "YYYY/MM/DD HH:mm")}
          </p>
        </div>
        <Badge variant="outline" className={ORDER_STATUS_BADGE_CLASS[status]}>
          {ORDER_STATUS_LABELS[status]}
        </Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <p>نام: {order.customerName}</p>
        <p dir="ltr">موبایل: {order.customerPhone}</p>
        <p className="sm:col-span-2">آدرس: {order.customerAddress || "—"}</p>
        <p className="sm:col-span-2">یادداشت مشتری: {order.customerNotes || "—"}</p>
        <p className="font-semibold sm:col-span-2">
          مبلغ کل: {quotePending ? "نیازمند استعلام" : formatTomansFromRial(order.totalAmountRial)}
        </p>
      </div>

      <div className="space-y-2">
        <p className="font-semibold">اقلام</p>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between gap-3 border-b border-border py-2">
            <span>
              {item.productTitle} × {item.quantity}
            </span>
            <span>{quotePending ? "استعلام" : formatTomansFromRial(item.lineTotalRial)}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="font-semibold">رسید</p>
        {order.receiptImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={order.receiptImageUrl}
            alt={`رسید ${order.orderNumber}`}
            className="max-h-72 rounded-md border border-border object-contain"
          />
        ) : (
          <p className="text-muted-foreground">
            {quotePending ? "این سفارش در انتظار اعلام قیمت است و رسید ندارد." : "رسید ثبت نشده است."}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {quotePending ? (
          <MoneyInput
            value={quotedTotalRial}
            onChange={setQuotedTotalRial}
            label="مبلغ اعلام‌شده (تومان)"
            placeholder="قیمت نهایی پس از استعلام"
          />
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="admin-notes">یادداشت ادمین</Label>
          <Textarea
            id="admin-notes"
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            rows={3}
            maxLength={2000}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tracking-code">کد پیگیری ارسال</Label>
          <Input
            id="tracking-code"
            value={trackingCode}
            onChange={(e) => setTrackingCode(e.target.value)}
            maxLength={80}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((next) => (
          <Button
            key={next}
            type="button"
            size="sm"
            variant={next === "CANCELLED" ? "destructive" : "outline"}
            disabled={saving || next === status}
            onClick={() =>
              onUpdateStatus({
                status: next,
                adminNotes: adminNotes.trim() || undefined,
                trackingCode: trackingCode.trim() || undefined,
                quotedTotalRial:
                  quotePending && quotedTotalRial > 0 ? quotedTotalRial : undefined,
              })
            }
          >
            {ORDER_STATUS_LABELS[next]}
          </Button>
        ))}
      </div>
    </div>
  )
}
