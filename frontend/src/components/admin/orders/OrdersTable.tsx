"use client"

import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatToJalali } from "@/lib/date"
import { formatTomansFromRial } from "@/lib/money"
import {
  isOrderStatus,
  ORDER_STATUS_BADGE_CLASS,
  ORDER_STATUS_LABELS,
  type ShopOrder,
} from "@/lib/orders"

export function OrdersTable({
  orders,
  selectedId,
  onSelect,
}: {
  orders: ShopOrder[]
  selectedId?: string | null
  onSelect: (order: ShopOrder) => void
}) {
  if (orders.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">سفارشی یافت نشد.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>شماره</TableHead>
          <TableHead>مشتری</TableHead>
          <TableHead>موبایل</TableHead>
          <TableHead>مبلغ</TableHead>
          <TableHead>وضعیت</TableHead>
          <TableHead>تاریخ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const status = isOrderStatus(order.status) ? order.status : "PENDING_VERIFICATION"
          return (
            <TableRow
              key={order.id}
              className={`cursor-pointer ${selectedId === order.id ? "bg-muted/60" : ""}`}
              onClick={() => onSelect(order)}
            >
              <TableCell className="font-semibold">{order.orderNumber}</TableCell>
              <TableCell>{order.customerName}</TableCell>
              <TableCell dir="ltr">{order.customerPhone}</TableCell>
              <TableCell>{formatTomansFromRial(order.totalAmountRial)}</TableCell>
              <TableCell>
                <Badge variant="outline" className={ORDER_STATUS_BADGE_CLASS[status]}>
                  {ORDER_STATUS_LABELS[status]}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatToJalali(order.createdAt, "YYYY/MM/DD HH:mm")}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
