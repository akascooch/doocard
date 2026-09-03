'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import axios from '@/lib/axios'
import { formatTomansFromRial } from '@/lib/money'
import { formatToJalali } from '@/lib/date'

interface DebtorRow {
  customerId: number
  name: string
  phone: string | null
  openDebtCount: number
  totalOpenRial: string
  oldestOpenAt: string | null
  newestOpenAt: string | null
}

interface OpenDebtDetail {
  id: number
  amountRial: string
  description: string | null
  createdAt: string
  appointmentId: number | null
  appointmentScheduledAt: string | null
}

export default function AdminDebtorsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [debtors, setDebtors] = useState<DebtorRow[]>([])
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [selected, setSelected] = useState<DebtorRow | null>(null)
  const [details, setDetails] = useState<OpenDebtDetail[]>([])
  const [detailTotal, setDetailTotal] = useState('0')

  const loadDebtors = useCallback(async () => {
    try {
      setLoading(true)
      const res = await axios.get('/admin/debtors')
      setDebtors(res.data?.debtors || [])
    } catch (err: any) {
      console.error(err)
      toast({
        title: 'خطا',
        description: err?.response?.data?.message || 'بارگذاری بدهکاران ناموفق بود',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadDebtors()
  }, [loadDebtors])

  const openDetails = async (row: DebtorRow) => {
    setSelected(row)
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await axios.get(`/customers/${row.customerId}/open-debts`)
      setDetails(res.data?.debts || [])
      setDetailTotal(res.data?.totalOpenRial || '0')
    } catch (err: any) {
      toast({
        title: 'خطا',
        description: err?.response?.data?.message || 'بارگذاری جزئیات بدهی ناموفق بود',
        variant: 'destructive',
      })
      setDetails([])
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">بدهکاران</h1>
          <p className="text-sm text-muted-foreground mt-1">
            مشتریان دارای حداقل یک بدهی باز (تسویه‌نشده)
          </p>
        </div>
        <Button variant="outline" onClick={loadDebtors} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <RefreshCw className="h-4 w-4 ml-2" />}
          به‌روزرسانی
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-main-orange" />
            فهرست بدهکاران
          </CardTitle>
          <CardDescription>
            {loading ? 'در حال بارگذاری…' : `${debtors.length} مشتری`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-main-orange" />
            </div>
          ) : debtors.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">بدهی بازی ثبت نشده است</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>تلفن</TableHead>
                  <TableHead>تعداد بدهی</TableHead>
                  <TableHead>جمع بدهی</TableHead>
                  <TableHead>قدیمی‌ترین</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtors.map((d) => (
                  <TableRow key={d.customerId}>
                    <TableCell className="font-medium">{d.name}</TableCell>
                    <TableCell>{d.phone || '—'}</TableCell>
                    <TableCell>{d.openDebtCount}</TableCell>
                    <TableCell className="text-main-orange font-semibold">
                      {formatTomansFromRial(d.totalOpenRial)}
                    </TableCell>
                    <TableCell>
                      {d.oldestOpenAt ? formatToJalali(d.oldestOpenAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => openDetails(d)}>
                        جزئیات
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              بدهی‌های باز — {selected?.name || ''}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                جمع: <span className="font-bold text-main-orange">{formatTomansFromRial(detailTotal)}</span>
              </p>
              {details.length === 0 ? (
                <p className="text-muted-foreground text-sm">موردی نیست</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {details.map((d) => (
                    <li key={d.id} className="border rounded-md p-3">
                      <div className="font-semibold">{formatTomansFromRial(d.amountRial)}</div>
                      <div className="text-muted-foreground">
                        ثبت: {formatToJalali(d.createdAt)}
                        {d.appointmentId ? ` — نوبت #${d.appointmentId}` : ''}
                        {d.appointmentScheduledAt
                          ? ` (${formatToJalali(d.appointmentScheduledAt)})`
                          : ''}
                      </div>
                      {d.description && <div className="mt-1">{d.description}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
