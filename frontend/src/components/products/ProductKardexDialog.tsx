"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { api } from "@/lib/axios"
import { formatAppointmentWhenTehran, getTehranTodayJalali, jalaliDateRangeBoundsTehran } from "@/lib/date"
import PersianDatePicker from "@/components/ui/PersianDatePicker"

type KardexRow = {
  id: number
  occurredAt: string
  type: string
  quantityIn: number
  quantityOut: number
  balanceAfter: number
  unitLabel: string | null
  packagingName: string | null
  reason: string | null
  referenceType: string | null
  referenceId: number | null
  barberName: string | null
  customerName: string | null
  appointmentId: string | null
}

const TYPE_LABEL: Record<string, string> = {
  IN: "ورود",
  OUT: "خروج",
  ADJUSTMENT: "اصلاح",
  APPOINTMENT_SALE: "فروش نوبت",
  REVERSAL: "برگشت",
  SALE: "فروش",
  RETURN: "مرجوعی",
}

const REF_LABEL: Record<string, string> = {
  APPOINTMENT: "نوبت",
  MANUAL: "دستی",
  ORDER: "سفارش",
}

function apiErrorMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { message_fa?: string; message?: string | string[] } } })
    ?.response?.data
  if (typeof data?.message_fa === "string") return data.message_fa
  if (typeof data?.message === "string") return data.message
  if (Array.isArray(data?.message)) return data.message[0]
  return fallback
}

export function ProductKardexDialog({
  productId,
  productName,
  stock,
  open,
  onOpenChange,
}: {
  productId: number
  productName: string
  stock: number
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const today = getTehranTodayJalali()
  const [fromJalali, setFromJalali] = useState("")
  const [toJalali, setToJalali] = useState("")
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<KardexRow[]>([])
  const [openingBalance, setOpeningBalance] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const bounds =
        fromJalali && toJalali ? jalaliDateRangeBoundsTehran(fromJalali, toJalali) : null
      const res = await api.get(`/products/${productId}/kardex`, {
        params: {
          limit: 200,
          ...(bounds ? { from: bounds.from, to: bounds.to } : {}),
        },
      })
      setRows(res.data.data || [])
      setOpeningBalance(res.data.openingBalance ?? 0)
    } catch (err) {
      const message = apiErrorMessage(err, "بارگذاری کاردکس ناموفق بود")
      setError(message)
      toast({ title: "خطا", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [fromJalali, productId, toJalali, toast])

  useEffect(() => {
    if (!open) return
    if (!fromJalali && today) setFromJalali(`${today.slice(0, 8)}01`)
    if (!toJalali && today) setToJalali(today)
  }, [open, fromJalali, toJalali, today])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>کاردکس کالا</DialogTitle>
          <DialogDescription>
            {productName} · موجودی فعلی: {stock}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <PersianDatePicker value={fromJalali} onChange={setFromJalali} label="از تاریخ" />
          <PersianDatePicker value={toJalali} onChange={setToJalali} label="تا تاریخ" />
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" onClick={() => void load()}>
              اعمال فیلتر
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">مانده ابتدای بازه: {openingBalance}</p>
        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">در حال بارگذاری...</p>
          ) : error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              حرکتی در این بازه ثبت نشده است.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="p-2 font-medium">زمان</th>
                  <th className="p-2 font-medium">نوع</th>
                  <th className="p-2 font-medium">ورود</th>
                  <th className="p-2 font-medium">خروج</th>
                  <th className="p-2 font-medium">مانده</th>
                  <th className="p-2 font-medium">نوبت / آرایشگر / مشتری</th>
                  <th className="p-2 font-medium">شرح</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-2 whitespace-nowrap">{formatAppointmentWhenTehran(row.occurredAt)}</td>
                    <td className="p-2">{TYPE_LABEL[row.type] || row.type}</td>
                    <td className="p-2">{row.quantityIn || "—"}</td>
                    <td className="p-2">{row.quantityOut || "—"}</td>
                    <td className="p-2 font-medium">{row.balanceAfter}</td>
                    <td className="p-2">
                      {row.appointmentId ? (
                        <span className="block text-xs">
                          نوبت #{row.appointmentId}
                          {row.barberName ? ` · ${row.barberName}` : ""}
                          {row.customerName ? ` · ${row.customerName}` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-2">
                      <span>{row.reason || "—"}</span>
                      {row.packagingName ? (
                        <span className="block text-xs text-muted-foreground">
                          {row.packagingName} ({row.unitLabel})
                        </span>
                      ) : null}
                      {row.referenceType ? (
                        <span className="block text-xs text-muted-foreground">
                          {REF_LABEL[row.referenceType] || row.referenceType}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
