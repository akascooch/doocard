'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { useToast } from '@/components/ui/use-toast'
import axios from '@/lib/axios'
import { formatTomansFromRial } from '@/lib/money'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

type ServiceStaff = { id: number; name: string }

type ReportSummary = {
  sourceTransactionCount: number
  totalSourceAmountRial: string
  teamSourceCount: number
  teamSourceAmountRial: string
  individualSourceCount: number
  individualSourceAmountRial: string
  teamAllocatedAmountRial: string
  teamReconciliationDifferenceRial: string
  paidAllocationAmountRial: string
  unpaidAllocationAmountRial: string
  allocationRowCount: number
  settledOnDifferentDayCount?: number
}

type ReportItem = {
  sourceKey: string
  origin: 'APPOINTMENT' | 'MANUAL'
  sourceId: number
  tipType: 'TEAM' | 'INDIVIDUAL' | null
  amountRial: string
  effectiveJalali: string
  effectiveBusinessAt: string
  scheduledJalali?: string | null
  paidJalali?: string | null
  isSettledOnDifferentDay?: boolean
  note: string | null
  creatorName: string | null
  individualRecipientName: string | null
  allocationCount: number
  allocatedAmountRial: string
  reconciliationDifferenceRial: string
  paymentStatus: string
  allocations: Array<{
    id: number
    employeeId: number
    employeeName: string
    employeeRole: string | null
    amountRial: string
    paid: boolean
    paidInSettlementId: number | null
  }>
}

type PreviewResult = {
  amountRial: string
  allocations: Array<{
    employeeId: number
    employeeName: string
    amountRial: string
    amountToman: string
  }>
  reconciliationDifferenceRial: string
  rejectedEmployeeIds: number[]
  eligibleEmployeeIds: number[]
}

function todayJalaliFallback(): string {
  // UI date pickers usually set this; fallback avoids empty submit.
  return '1405/04/20'
}

export default function AdminTipsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<'register' | 'report'>('report')
  const [staff, setStaff] = useState<ServiceStaff[]>([])
  const [loadingStaff, setLoadingStaff] = useState(false)

  // Register form
  const [tipType, setTipType] = useState<'TEAM' | 'INDIVIDUAL'>('TEAM')
  const [amountToman, setAmountToman] = useState('')
  const [effectiveJalali, setEffectiveJalali] = useState(todayJalaliFallback())
  const [recipientId, setRecipientId] = useState<string>('')
  const [teamIds, setTeamIds] = useState<number[]>([])
  const [note, setNote] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  // Report filters
  const [fromJalali, setFromJalali] = useState('1405/04/20')
  const [toJalali, setToJalali] = useState('1405/04/20')
  const [filterType, setFilterType] = useState<'ALL' | 'TEAM' | 'INDIVIDUAL'>('ALL')
  const [filterOrigin, setFilterOrigin] = useState<'ALL' | 'APPOINTMENT' | 'MANUAL'>('ALL')
  const [filterEmployeeId, setFilterEmployeeId] = useState<string>('ALL')
  const [filterPaid, setFilterPaid] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL')
  const [dateAxis, setDateAxis] = useState<'PAID_AT' | 'SCHEDULED_AT'>('PAID_AT')
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [items, setItems] = useState<ReportItem[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const loadStaff = useCallback(async () => {
    setLoadingStaff(true)
    try {
      const res = await axios.get('/employees/service-staff/active')
      const rows = Array.isArray(res.data) ? res.data : res.data?.data || []
      setStaff(
        rows.map((r: { id: number; user?: { name?: string }; name?: string }) => ({
          id: r.id,
          name: r.user?.name || r.name || `کارمند #${r.id}`,
        })),
      )
    } catch {
      toast({ title: 'خطا', description: 'بارگذاری پرسنل خدمات ناموفق بود', variant: 'destructive' })
    } finally {
      setLoadingStaff(false)
    }
  }, [toast])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const loadReport = useCallback(async () => {
    setReportLoading(true)
    setReportError(null)
    try {
      const res = await axios.get('/admin/tips/report', {
        params: {
          from: fromJalali,
          to: toJalali,
          tipType: filterType,
          origin: filterOrigin,
          paidState: filterPaid,
          dateAxis,
          ...(filterEmployeeId !== 'ALL' ? { employeeId: filterEmployeeId } : {}),
          page: 1,
          pageSize: 100,
        },
      })
      setSummary(res.data.summary)
      setItems(res.data.items || [])
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'خطا در دریافت گزارش'
      setReportError(typeof msg === 'string' ? msg : 'خطا در دریافت گزارش')
      setSummary(null)
      setItems([])
    } finally {
      setReportLoading(false)
    }
  }, [fromJalali, toJalali, filterType, filterOrigin, filterPaid, filterEmployeeId, dateAxis])

  useEffect(() => {
    if (tab === 'report') loadReport()
  }, [tab, loadReport])

  const toggleTeam = (id: number) => {
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    setPreview(null)
  }

  const amountNum = useMemo(() => {
    const n = parseInt(amountToman.replace(/[^\d]/g, ''), 10)
    return Number.isFinite(n) ? n : 0
  }, [amountToman])

  const canPreview =
    amountNum > 0 &&
    !!effectiveJalali &&
    (tipType === 'INDIVIDUAL' ? !!recipientId : teamIds.length > 0)

  const runPreview = async () => {
    if (!canPreview) return
    setPreviewing(true)
    try {
      const body =
        tipType === 'TEAM'
          ? {
              tipType,
              amountToman: amountNum,
              effectiveJalali,
              teamMemberIds: teamIds,
              note: note || undefined,
            }
          : {
              tipType,
              amountToman: amountNum,
              effectiveJalali,
              recipientEmployeeId: parseInt(recipientId, 10),
              note: note || undefined,
            }
      const res = await axios.post('/admin/tips/preview', body)
      setPreview(res.data)
      toast({ title: 'پیش‌نمایش آماده است' })
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'پیش‌نمایش ناموفق'
      toast({
        title: 'خطا',
        description: Array.isArray(msg) ? msg.join('، ') : String(msg),
        variant: 'destructive',
      })
    } finally {
      setPreviewing(false)
    }
  }

  const runCreate = async () => {
    if (!preview || !canPreview) return
    setSubmitting(true)
    try {
      const idempotencyKey = `manual-tip-${tipType}-${effectiveJalali}-${amountNum}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const body =
        tipType === 'TEAM'
          ? {
              tipType,
              amountToman: amountNum,
              effectiveJalali,
              teamMemberIds: teamIds,
              note: note || undefined,
              idempotencyKey,
            }
          : {
              tipType,
              amountToman: amountNum,
              effectiveJalali,
              recipientEmployeeId: parseInt(recipientId, 10),
              note: note || undefined,
              idempotencyKey,
            }
      const res = await axios.post('/admin/tips', body)
      toast({
        title: res.data.duplicate ? 'قبلاً ثبت شده بود' : 'ثبت شد',
        description: `شناسه منبع: ${res.data.tipSourceId}`,
      })
      setPreview(null)
      setAmountToman('')
      setNote('')
      setTab('report')
      await loadReport()
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message || 'ثبت ناموفق'
      toast({
        title: 'خطا',
        description: Array.isArray(msg) ? msg.join('، ') : String(msg),
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const resetFilters = () => {
    setFromJalali('1405/04/20')
    setToJalali('1405/04/20')
    setFilterType('ALL')
    setFilterOrigin('ALL')
    setFilterEmployeeId('ALL')
    setFilterPaid('ALL')
    setDateAxis('PAID_AT')
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">انعام</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ثبت دستی و گزارش انعام — ۱۰۰٪ متعلق به پرسنل خدمات
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          variant={tab === 'register' ? 'default' : 'outline'}
          onClick={() => setTab('register')}
        >
          ثبت انعام
        </Button>
        <Button
          variant={tab === 'report' ? 'default' : 'outline'}
          onClick={() => setTab('report')}
        >
          گزارش انعام
        </Button>
      </div>

      {tab === 'register' && (
        <Card>
          <CardHeader>
            <CardTitle>ثبت انعام دستی</CardTitle>
            <CardDescription>
              مبلغ به تومان وارد می‌شود و یک‌بار به ریال تبدیل می‌گردد. فقط ADMIN مجاز به ثبت است.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>نوع</Label>
                <Select
                  value={tipType}
                  onValueChange={(v) => {
                    setTipType(v as 'TEAM' | 'INDIVIDUAL')
                    setPreview(null)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAM">تیمی</SelectItem>
                    <SelectItem value="INDIVIDUAL">فردی</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>مبلغ (تومان)</Label>
                <Input
                  value={amountToman}
                  onChange={(e) => {
                    setAmountToman(e.target.value)
                    setPreview(null)
                  }}
                  inputMode="numeric"
                  placeholder="مثلاً ۳۴۰۰۰۰۰"
                />
              </div>
              <div className="space-y-2">
                <Label>تاریخ مؤثر (شمسی)</Label>
                <PersianDatePicker
                  value={effectiveJalali}
                  onChange={(v) => {
                    setEffectiveJalali(v || todayJalaliFallback())
                    setPreview(null)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>یادداشت (اختیاری)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </div>
            </div>

            {tipType === 'INDIVIDUAL' ? (
              <div className="space-y-2">
                <Label>گیرنده (پرسنل خدمات)</Label>
                <Select
                  value={recipientId}
                  onValueChange={(v) => {
                    setRecipientId(v)
                    setPreview(null)
                  }}
                  disabled={loadingStaff}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name} (#{s.id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>اعضای تیم خدمات</Label>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {staff.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={teamIds.includes(s.id)}
                        onCheckedChange={() => toggleTeam(s.id)}
                      />
                      {s.name} (#{s.id})
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={runPreview} disabled={!canPreview || previewing}>
                {previewing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                پیش‌نمایش
              </Button>
              <Button
                onClick={runCreate}
                disabled={!preview || submitting || preview.reconciliationDifferenceRial !== '0'}
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                تأیید و ثبت
              </Button>
            </div>

            {preview && (
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <div>مبلغ منبع: {formatTomansFromRial(preview.amountRial)}</div>
                <div>
                  مغایرت تخصیص:{' '}
                  {formatTomansFromRial(preview.reconciliationDifferenceRial)}
                </div>
                {preview.rejectedEmployeeIds.length > 0 && (
                  <div className="text-amber-700">
                    ردشده: {preview.rejectedEmployeeIds.join('، ')}
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">کارمند</TableHead>
                      <TableHead className="text-right">مبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.allocations.map((a) => (
                      <TableRow key={a.employeeId}>
                        <TableCell>
                          {a.employeeName} (#{a.employeeId})
                        </TableCell>
                        <TableCell>{formatTomansFromRial(a.amountRial)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'report' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>فیلتر گزارش</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>از تاریخ</Label>
                <PersianDatePicker value={fromJalali} onChange={(v) => setFromJalali(v || fromJalali)} />
              </div>
              <div className="space-y-2">
                <Label>تا تاریخ</Label>
                <PersianDatePicker value={toJalali} onChange={(v) => setToJalali(v || toJalali)} />
              </div>
              <div className="space-y-2">
                <Label>نوع</Label>
                <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">همه</SelectItem>
                    <SelectItem value="TEAM">تیمی</SelectItem>
                    <SelectItem value="INDIVIDUAL">فردی</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>منبع</Label>
                <Select
                  value={filterOrigin}
                  onValueChange={(v) => setFilterOrigin(v as typeof filterOrigin)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">همه</SelectItem>
                    <SelectItem value="APPOINTMENT">نوبت</SelectItem>
                    <SelectItem value="MANUAL">دستی</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>گیرنده</Label>
                <Select value={filterEmployeeId} onValueChange={setFilterEmployeeId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">همه</SelectItem>
                    {staff.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>محور تاریخ</Label>
                <Select
                  value={dateAxis}
                  onValueChange={(v) => setDateAxis(v as typeof dateAxis)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAID_AT">تاریخ تسویه (پرداخت)</SelectItem>
                    <SelectItem value="SCHEDULED_AT">تاریخ نوبت (هم‌تراز نوبت‌ها)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>وضعیت پرداخت</Label>
                <Select value={filterPaid} onValueChange={(v) => setFilterPaid(v as typeof filterPaid)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">همه</SelectItem>
                    <SelectItem value="PAID">پرداخت‌شده</SelectItem>
                    <SelectItem value="UNPAID">پرداخت‌نشده</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={loadReport} disabled={reportLoading}>
                  {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'اعمال'}
                </Button>
                <Button variant="outline" onClick={resetFilters}>
                  بازنشانی
                </Button>
              </div>
            </CardContent>
          </Card>

          {summary && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[
                [
                  dateAxis === 'SCHEDULED_AT'
                    ? 'تعداد منبع (محور تاریخ نوبت)'
                    : 'تعداد کل تراکنش‌های منبع',
                  String(summary.sourceTransactionCount),
                ],
                ['مجموع کل انعام', formatTomansFromRial(summary.totalSourceAmountRial)],
                ['تعداد انعام تیمی', String(summary.teamSourceCount)],
                ['مبلغ انعام تیمی', formatTomansFromRial(summary.teamSourceAmountRial)],
                ['تعداد انعام فردی', String(summary.individualSourceCount)],
                ['مبلغ انعام فردی', formatTomansFromRial(summary.individualSourceAmountRial)],
                ['مجموع تخصیص تیمی', formatTomansFromRial(summary.teamAllocatedAmountRial)],
                [
                  'مغایرت تخصیص',
                  formatTomansFromRial(summary.teamReconciliationDifferenceRial),
                ],
                ['پرداخت‌شده', formatTomansFromRial(summary.paidAllocationAmountRial)],
                ['پرداخت‌نشده', formatTomansFromRial(summary.unpaidAllocationAmountRial)],
                [
                  'تسویه در روز دیگر',
                  String(summary.settledOnDifferentDayCount ?? 0),
                ],
              ].map(([label, value]) => (
                <Card key={label as string}>
                  <CardHeader className="py-3 px-4">
                    <CardDescription>{label}</CardDescription>
                    <CardTitle className="text-base tabular-nums">{value}</CardTitle>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {reportError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {reportError}
            </div>
          )}

          {!reportLoading && !reportError && items.length === 0 && (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">
              تراکنشی برای این فیلتر یافت نشد
            </div>
          )}

          {items.length > 0 && (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">شناسه</TableHead>
                      <TableHead className="text-right">تاریخ</TableHead>
                      <TableHead className="text-right">منبع</TableHead>
                      <TableHead className="text-right">نوع</TableHead>
                      <TableHead className="text-right">مبلغ</TableHead>
                      <TableHead className="text-right">گیرنده</TableHead>
                      <TableHead className="text-right">تخصیص</TableHead>
                      <TableHead className="text-right">مغایرت</TableHead>
                      <TableHead className="text-right">وضعیت</TableHead>
                      <TableHead className="text-right">جزئیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((row) => (
                      <Fragment key={row.sourceKey}>
                        <TableRow>
                          <TableCell className="tabular-nums">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>
                                {row.origin === 'MANUAL'
                                  ? `M-${row.sourceId}`
                                  : `#${row.sourceId}`}
                              </span>
                              {row.isSettledOnDifferentDay && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex">
                                      <Badge
                                        variant="warning"
                                        className="normal-case tracking-normal cursor-help"
                                      >
                                        تسویه روز دیگر
                                      </Badge>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-right" dir="rtl">
                                    <div className="space-y-1 text-xs">
                                      <div>تاریخ نوبت: {row.scheduledJalali || '—'}</div>
                                      <div>تاریخ تسویه: {row.paidJalali || '—'}</div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">
                            <div>{row.effectiveJalali}</div>
                            {row.isSettledOnDifferentDay && row.paidJalali && dateAxis === 'SCHEDULED_AT' && (
                              <div className="text-[11px] text-muted-foreground">
                                تسویه: {row.paidJalali}
                              </div>
                            )}
                            {row.isSettledOnDifferentDay && row.scheduledJalali && dateAxis === 'PAID_AT' && (
                              <div className="text-[11px] text-muted-foreground">
                                نوبت: {row.scheduledJalali}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{row.origin === 'MANUAL' ? 'دستی' : 'نوبت'}</TableCell>
                          <TableCell>
                            {row.tipType === 'TEAM' ? 'تیمی' : row.tipType === 'INDIVIDUAL' ? 'فردی' : '—'}
                          </TableCell>
                          <TableCell>{formatTomansFromRial(row.amountRial)}</TableCell>
                          <TableCell>{row.individualRecipientName || '—'}</TableCell>
                          <TableCell className="tabular-nums">
                            {row.allocationCount} / {formatTomansFromRial(row.allocatedAmountRial)}
                          </TableCell>
                          <TableCell>
                            {formatTomansFromRial(row.reconciliationDifferenceRial)}
                          </TableCell>
                          <TableCell>
                            {row.paymentStatus === 'PAID'
                              ? 'پرداخت‌شده'
                              : row.paymentStatus === 'UNPAID'
                                ? 'پرداخت‌نشده'
                                : '—'}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setExpanded((p) => ({
                                  ...p,
                                  [row.sourceKey]: !p[row.sourceKey],
                                }))
                              }
                            >
                              {expanded[row.sourceKey] ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded[row.sourceKey] && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-muted/20">
                              <div className="text-xs space-y-2 p-2">
                                {row.creatorName && <div>ثبت‌کننده: {row.creatorName}</div>}
                                {row.note && <div>یادداشت: {row.note}</div>}
                                {row.scheduledJalali && (
                                  <div>تاریخ نوبت: {row.scheduledJalali}</div>
                                )}
                                {row.paidJalali && <div>تاریخ تسویه: {row.paidJalali}</div>}
                                <div>
                                  مجموع تخصیص: {formatTomansFromRial(row.allocatedAmountRial)} —
                                  مغایرت:{' '}
                                  {formatTomansFromRial(row.reconciliationDifferenceRial)}
                                </div>
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-right">کارمند</TableHead>
                                      <TableHead className="text-right">نقش</TableHead>
                                      <TableHead className="text-right">مبلغ</TableHead>
                                      <TableHead className="text-right">وضعیت</TableHead>
                                      <TableHead className="text-right">تسویه</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {row.allocations.map((a) => (
                                      <TableRow key={a.id}>
                                        <TableCell>
                                          {a.employeeName} (#{a.employeeId})
                                        </TableCell>
                                        <TableCell>{a.employeeRole || '—'}</TableCell>
                                        <TableCell>
                                          {formatTomansFromRial(a.amountRial)}
                                        </TableCell>
                                        <TableCell>
                                          {a.paid ? 'پرداخت‌شده' : 'پرداخت‌نشده'}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                          {a.paidInSettlementId ?? '—'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
                </TooltipProvider>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
