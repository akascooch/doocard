"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, Clock, User, Scissors, Search } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getCurrentUser } from '@/lib/auth'
import { getDashboardHomePath } from '@/lib/user-roles'
import { formatToJalali, getTehranAppointmentPresetRange, getTehranTodayJalali, jalaliDateRangeBoundsTehran } from '@/lib/date'
import { formatTomansFromRial } from '@/lib/money'

type HistoryItem = {
  id: number
  scheduledAt?: string
  status: string
  durationMin?: number
  amount?: number | string | null
  serviceAmount?: number | string | null
  totalAmount?: number | string | null
  serviceName?: string | null
  employeeName?: string | null
  services?: Array<{ serviceName?: string; name?: string; durationMin?: number }>
  service?: { name?: string; durationMinutes?: number } | null
  employee?: { user?: { name?: string } } | null
  calendarDate?: { jalaliDate?: string } | null
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  COMPLETED: { label: 'انجام شده', className: 'bg-green-100 text-green-800' },
  SETTLED: { label: 'تسویه شده', className: 'bg-green-100 text-green-800' },
  PAID: { label: 'پرداخت شده', className: 'bg-emerald-100 text-emerald-800' },
  CANCELLED: { label: 'لغو شده', className: 'bg-red-100 text-red-800' },
  CONFIRMED: { label: 'تأیید شده', className: 'bg-blue-100 text-blue-800' },
  PENDING: { label: 'در انتظار', className: 'bg-yellow-100 text-yellow-800' },
  PENDING_CONFIRMATION: { label: 'در انتظار تأیید', className: 'bg-yellow-100 text-yellow-800' },
}

type DatePreset = 'all' | 'month' | 'week' | 'year'

function serviceLabel(item: HistoryItem) {
  if (Array.isArray(item.services) && item.services.length) {
    return item.services
      .map((s) => s.serviceName || s.name)
      .filter(Boolean)
      .join('، ')
  }
  return item.serviceName || item.service?.name || 'خدمت'
}

function amountRial(item: HistoryItem) {
  return item.amount ?? item.totalAmount ?? item.serviceAmount ?? 0
}

export default function CustomerHistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [appointments, setAppointments] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState<DatePreset>('all')

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser && currentUser.role !== 'CUSTOMER') {
      router.replace(getDashboardHomePath(currentUser.role))
      return
    }
    const load = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/appointments/customer-history', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Failed to fetch appointment history')
        const data = await response.json()
        setAppointments(Array.isArray(data) ? data : data?.data || [])
      } catch (error) {
        console.error('Error fetching appointments:', error)
        toast({
          title: 'خطا',
          description: 'خطا در دریافت تاریخچه نوبت‌ها',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router, toast])

  const filtered = useMemo(() => {
    let rows = appointments
    if (searchTerm) {
      const term = searchTerm.trim()
      rows = rows.filter((item) => {
        const hay = `${serviceLabel(item)} ${item.employeeName ?? item.employee?.user?.name ?? ''}`
        return hay.includes(term)
      })
    }
    if (statusFilter !== 'all') {
      rows = rows.filter((item) => item.status === statusFilter)
    }
    if (dateFilter !== 'all') {
      const range =
        dateFilter === 'year'
          ? jalaliDateRangeBoundsTehran(`${getTehranTodayJalali().slice(0, 4)}/01/01`, getTehranTodayJalali())
          : getTehranAppointmentPresetRange(dateFilter)
      const from = range?.from ? new Date(range.from).getTime() : 0
      const to = range?.to ? new Date(range.to).getTime() : Date.now()
      rows = rows.filter((item) => {
        if (!item.scheduledAt) return false
        const t = new Date(item.scheduledAt).getTime()
        return t >= from && t <= to
      })
    }
    return rows
  }, [appointments, searchTerm, statusFilter, dateFilter])

  const doneCount = appointments.filter((a) =>
    ['COMPLETED', 'SETTLED', 'PAID'].includes(a.status),
  ).length
  const cancelledCount = appointments.filter((a) => a.status === 'CANCELLED').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">تاریخچه نوبت‌ها</h1>
        <p className="text-muted-foreground text-sm mt-1">نوبت‌های انجام‌شده و لغو شده</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">کل</p>
            <p className="text-xl font-bold">{appointments.length.toLocaleString('fa-IR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">انجام‌شده</p>
            <p className="text-xl font-bold">{doneCount.toLocaleString('fa-IR')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">لغو شده</p>
            <p className="text-xl font-bold">{cancelledCount.toLocaleString('fa-IR')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">فیلتر</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pr-9"
              placeholder="جستجوی خدمت یا آرایشگر"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="SETTLED">تسویه شده</SelectItem>
              <SelectItem value="PAID">پرداخت شده</SelectItem>
              <SelectItem value="COMPLETED">انجام شده</SelectItem>
              <SelectItem value="CANCELLED">لغو شده</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DatePreset)}>
            <SelectTrigger>
              <SelectValue placeholder="بازه زمانی" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه زمان‌ها</SelectItem>
              <SelectItem value="week">این هفته</SelectItem>
              <SelectItem value="month">ماه جاری</SelectItem>
              <SelectItem value="year">سال جاری</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            نوبتی با این فیلتر یافت نشد
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const meta = STATUS_META[item.status] || { label: item.status, className: '' }
            const jalali =
              item.calendarDate?.jalaliDate ||
              (item.scheduledAt ? formatToJalali(item.scheduledAt) : '—')
            const time = item.scheduledAt
              ? new Date(item.scheduledAt).toLocaleTimeString('fa-IR', {
                  timeZone: 'Asia/Tehran',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })
              : ''
            const employee = item.employeeName || item.employee?.user?.name || 'آرایشگر'
            return (
              <Card key={item.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{serviceLabel(item)}</h3>
                      <Badge variant="outline" className={meta.className}>
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {jalali}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {time}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {employee}
                      </span>
                      {item.durationMin ? (
                        <span className="flex items-center gap-1">
                          <Scissors className="h-3.5 w-3.5" />
                          {item.durationMin} دقیقه
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {formatTomansFromRial(amountRial(item))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => router.push('/dashboard/customer/appointments')}>
          رزرو نوبت جدید
        </Button>
      </div>
    </div>
  )
}
