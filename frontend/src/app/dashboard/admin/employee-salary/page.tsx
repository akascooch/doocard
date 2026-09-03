'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { useToast } from '@/components/ui/use-toast'
import axios from '@/lib/axios'
import { formatTomansFromRial } from '@/lib/money'
import { formatToJalali } from '@/lib/date'
import {
  ServiceTipLine,
  ServiceTipLinesTable,
} from '@/components/salary/ServiceTipLinesTable'

interface Employee {
  id: number
  name: string
}

interface BankAccount {
  id: number
  name: string
}

interface PriorWithdrawal {
  id: number
  amount: string
  occurredAt: string
  description: string | null
  categoryName: string | null
}

interface PreviewAppointmentItem {
  id: number
  scheduledAtJalali: string
  status: string
  amountRial: string
  customerName: string
  taxApplied: string
  netShare: string
}

interface PreviewResult {
  totalAppointments: number
  totalRevenue: string
  employeeShare: string
  platformShare: string
  payoutGrossBeforeDeduction: string
  deductionPerAppointmentAmount: string
  totalDeduction: string
  payoutNetAfterDeduction: string
  priorWithdrawalsTotal: string
  /** Appointment-only withdrawable (excludes TEAM tips for barbers). May be negative. */
  netPayable: string
  /** Admin direct settlement total (barber: equals appointment netPayable). */
  settlementPayable?: string
  teamShareIncome?: string
  lastCommissionSettlementAt: string | null
  suggestedPeriodStartJalali: string | null
  commissionPercentageUsed: number
  priorWithdrawals: PriorWithdrawal[]
  excludedAlreadySettledAppointments: number
  breakdown: Array<
    | { date: string; count: number; revenue: string }
    | { weekLabel: string; count: number; revenue: string }
  >
  isServiceStaff?: boolean
  isSpecialCommission?: boolean
  totalTipIncome?: string
  tipAllocationCount?: number
  employeeRole?: string
  tipLines?: ServiceTipLine[]
  appointments?: PreviewAppointmentItem[]
}

interface SettlementHistoryItem {
  id: number
  periodStartJalali: string | null
  periodEndJalali: string | null
  appointmentCount: number
  netPayableRial: string
  status: 'ACTIVE' | 'REVERSED'
  settledAt: string
  reversedAt: string | null
}

function isDailyBreakdown(
  b: PreviewResult['breakdown'][0],
): b is { date: string; count: number; revenue: string } {
  return 'date' in b
}

export default function EmployeeSalaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [employeeId, setEmployeeId] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [percentage, setPercentage] = useState<string>('40')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [periodStartConfirmed, setPeriodStartConfirmed] = useState(false)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [history, setHistory] = useState<SettlementHistoryItem[]>([])
  const [pendingRequests, setPendingRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [expandedTipRequestId, setExpandedTipRequestId] = useState<number | null>(null)
  const [tipDetailByRequestId, setTipDetailByRequestId] = useState<
    Record<
      number,
      {
        loading: boolean
        tipLines: ServiceTipLine[] | null
        message: string | null
      }
    >
  >({})
  const { toast } = useToast()

  const fetchPendingRequests = useCallback(async () => {
    try {
      const res = await axios.get('/admin/employee-salary/requests', {
        params: { status: 'PENDING' },
      })
      setPendingRequests(res.data || [])
    } catch (err) {
      console.error(err)
      setPendingRequests([])
      toast({
        title: 'خطا',
        description: 'بارگذاری درخواست‌های حقوق ناموفق بود',
        variant: 'destructive',
      })
    }
  }, [toast])

  const fetchEmployees = useCallback(async () => {
    try {
      setEmployeesLoading(true)
      const [empRes, accRes] = await Promise.all([
        axios.get('/employees'),
        axios.get('/accounting/accounts'),
      ])
      const list = (empRes.data || []).map((e: { id: number; user?: { name: string }; name?: string }) => ({
        id: e.id,
        name: e.user?.name ?? e.name ?? `کارمند #${e.id}`,
      }))
      setEmployees(list)
      const accList = (accRes.data?.data ?? accRes.data ?? []).map((a: BankAccount) => ({
        id: a.id,
        name: a.name,
      }))
      setAccounts(accList)
      if (list.length > 0 && !employeeId) {
        setEmployeeId(String(list[0].id))
      }
      if (accList.length > 0 && !bankAccountId) {
        setBankAccountId(String(accList[0].id))
      }
    } catch (err) {
      console.error(err)
      toast({ title: 'خطا', description: 'بارگذاری داده‌ها ناموفق بود', variant: 'destructive' })
    } finally {
      setEmployeesLoading(false)
    }
  }, [employeeId, bankAccountId, toast])

  const fetchHistory = useCallback(async (empId: string) => {
    if (!empId) return
    try {
      const res = await axios.get('/admin/employee-salary/history', {
        params: { employeeId: empId },
      })
      setHistory(res.data || [])
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    fetchEmployees()
    fetchPendingRequests()
  }, [fetchEmployees, fetchPendingRequests])

  useEffect(() => {
    if (employeeId) {
      fetchHistory(employeeId)
    }
  }, [employeeId, fetchHistory])

  const handlePreview = async () => {
    if (!employeeId || !fromDate || !toDate) {
      toast({ title: 'خطا', description: 'کارمند، تاریخ از و تاریخ تا را انتخاب کنید', variant: 'destructive' })
      return
    }
    const pct = parseFloat(percentage)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast({ title: 'خطا', description: 'درصد باید بین ۰ تا ۱۰۰ باشد', variant: 'destructive' })
      return
    }
    try {
      setLoading(true)
      setPreview(null)
      setPeriodStartConfirmed(false)
      const res = await axios.get('/admin/employee-salary/preview', {
        params: { employeeId, from: fromDate, to: toDate, percentage: pct },
      })
      setPreview(res.data)
      if (res.data.suggestedPeriodStartJalali && !fromDate) {
        setFromDate(res.data.suggestedPeriodStartJalali)
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'خطا در دریافت پیش‌نمایش'
      toast({ title: 'خطا', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleCommit = async () => {
    if (!preview || !employeeId || !fromDate || !toDate) return
    if (!periodStartConfirmed) {
      toast({ title: 'خطا', description: 'تأیید تاریخ شروع دوره الزامی است', variant: 'destructive' })
      return
    }
    if (!bankAccountId) {
      toast({ title: 'خطا', description: 'حساب بانکی را انتخاب کنید', variant: 'destructive' })
      return
    }
    try {
      setCommitting(true)
      await axios.post('/admin/employee-salary/commit', {
        employeeId: parseInt(employeeId, 10),
        fromJalali: fromDate,
        toJalali: toDate,
        commissionPercentage: parseFloat(percentage) || preview.commissionPercentageUsed,
        periodStartConfirmed: true,
        bankAccountId: parseInt(bankAccountId, 10),
      })
      toast({ title: 'موفق', description: 'تسویه کمیسیون با موفقیت ثبت شد' })
      await fetchHistory(employeeId)
      setPreview(null)
      setPeriodStartConfirmed(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'خطا در ثبت تسویه'
      toast({ title: 'خطا', description: msg, variant: 'destructive' })
    } finally {
      setCommitting(false)
    }
  }

  const handleReverse = async (settlementId: number) => {
    if (!confirm('آیا از برگشت این تسویه اطمینان دارید؟')) return
    try {
      await axios.post(`/admin/employee-salary/${settlementId}/reverse`)
      toast({ title: 'موفق', description: 'تسویه برگشت داده شد' })
      if (employeeId) await fetchHistory(employeeId)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'خطا در برگشت تسویه'
      toast({ title: 'خطا', description: msg, variant: 'destructive' })
    }
  }

  const toggleTipDetails = async (requestId: number, row?: any) => {
    if (expandedTipRequestId === requestId) {
      setExpandedTipRequestId(null)
      return
    }
    setExpandedTipRequestId(requestId)

    const inline =
      row?.tipLines ??
      row?.snapshotJson?.tipLines ??
      null
    if (Array.isArray(inline)) {
      setTipDetailByRequestId((prev) => ({
        ...prev,
        [requestId]: {
          loading: false,
          tipLines: inline,
          message:
            inline.length === 0
              ? 'در این اسنپ‌شات هیچ ردیف انعامی ثبت نشده است.'
              : null,
        },
      }))
      return
    }

    if (tipDetailByRequestId[requestId]?.tipLines != null || tipDetailByRequestId[requestId]?.message) {
      return
    }

    setTipDetailByRequestId((prev) => ({
      ...prev,
      [requestId]: { loading: true, tipLines: null, message: null },
    }))
    try {
      const res = await axios.get(`/admin/employee-salary/requests/${requestId}`)
      const tipDetails = res.data?.tipDetails
      setTipDetailByRequestId((prev) => ({
        ...prev,
        [requestId]: {
          loading: false,
          tipLines: tipDetails?.available ? tipDetails.tipLines ?? [] : null,
          message: tipDetails?.message ?? null,
        },
      }))
    } catch {
      setTipDetailByRequestId((prev) => ({
        ...prev,
        [requestId]: {
          loading: false,
          tipLines: null,
          message: 'بارگذاری جزئیات انعام ناموفق بود',
        },
      }))
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">حقوق کارمندان</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          تسویه کمیسیون آرایشگران، انعام پرسنل خدمات، و تأیید درخواست‌های حقوق
        </p>
      </div>

      {pendingRequests.length > 0 && (
        <Card className="bg-white dark:bg-gray-900 border border-amber-300">
          <CardHeader>
            <CardTitle>درخواست‌های در انتظار ({pendingRequests.length})</CardTitle>
            <CardDescription>اسنپ‌شات ثبت‌شده توسط کارمند/پرسنل — قبل از پرداخت اختلاف با موجودی فعلی را بررسی کنید</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingRequests.map((r: any) => (
              <div
                key={r.id}
                className="rounded border p-3 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <div className="font-semibold">
                    {r.employee?.user?.name ?? `کارمند #${r.employeeId}`} — {r.requestType}
                    {r.employee?.user?.role === 'SERVICE' && (
                      <span className="mr-2 text-xs font-normal text-muted-foreground">
                        (پرسنل خدمات)
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    تا {r.upToJalali} | اسنپ‌شات:{' '}
                    {formatTomansFromRial(r.requestedAmountRial)} | موجودی هنگام درخواست:{' '}
                    {formatTomansFromRial(r.availableAtRequestRial)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(r.employee?.user?.role === 'SERVICE' ||
                    r.breakdown?.isServiceStaff ||
                    r.tipLinesAvailable) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleTipDetails(r.id, r)}
                    >
                      {expandedTipRequestId === r.id
                        ? 'بستن جزئیات انعام'
                        : 'مشاهده جزئیات انعام'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await axios.post(`/admin/employee-salary/requests/${r.id}/approve`)
                        toast({ title: 'تأیید شد' })
                        fetchPendingRequests()
                      } catch (err: any) {
                        toast({
                          title: 'خطا',
                          description: err?.response?.data?.message ?? 'خطا',
                          variant: 'destructive',
                        })
                      }
                    }}
                  >
                    تأیید
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 text-white"
                    onClick={async () => {
                      if (!bankAccountId) {
                        toast({ title: 'خطا', description: 'حساب بانکی را انتخاب کنید', variant: 'destructive' })
                        return
                      }
                      try {
                        const diff = await axios.get(
                          `/admin/employee-salary/requests/${r.id}/pay-diff`,
                        )
                        const ok = confirm(
                          `اسنپ‌شات: ${formatTomansFromRial(diff.data.snapshotAmount)}\nموجودی فعلی: ${formatTomansFromRial(diff.data.liveAvailable)}\nاختلاف: ${formatTomansFromRial(diff.data.diffRial)}\nپرداخت؟`,
                        )
                        if (!ok) return
                        await axios.post(`/admin/employee-salary/requests/${r.id}/pay`, {
                          bankAccountId: parseInt(bankAccountId, 10),
                        })
                        toast({ title: 'پرداخت شد' })
                        fetchPendingRequests()
                      } catch (err: any) {
                        toast({
                          title: 'خطا',
                          description: err?.response?.data?.message ?? 'خطا در پرداخت',
                          variant: 'destructive',
                        })
                      }
                    }}
                  >
                    پرداخت
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={async () => {
                      try {
                        await axios.post(`/admin/employee-salary/requests/${r.id}/reject`, {
                          reason: 'رد توسط ادمین',
                        })
                        toast({ title: 'رد شد' })
                        fetchPendingRequests()
                      } catch (err: any) {
                        toast({
                          title: 'خطا',
                          description: err?.response?.data?.message ?? 'خطا',
                          variant: 'destructive',
                        })
                      }
                    }}
                  >
                    رد
                  </Button>
                </div>
                </div>
                {expandedTipRequestId === r.id && (
                  <div>
                    {tipDetailByRequestId[r.id]?.loading ? (
                      <p className="text-sm text-muted-foreground">در حال بارگذاری جزئیات انعام...</p>
                    ) : (
                      <ServiceTipLinesTable
                        tipLines={tipDetailByRequestId[r.id]?.tipLines ?? null}
                        tipLinesKnownMissing
                        missingSnapshotMessage={
                          tipDetailByRequestId[r.id]?.message ||
                          'جزئیات انعام برای این درخواست قدیمی ذخیره نشده است.'
                        }
                        emptyMessage={
                          tipDetailByRequestId[r.id]?.message ||
                          'در این اسنپ‌شات هیچ ردیف انعامی ثبت نشده است.'
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">پارامترها</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            کارمند، بازه تاریخ و درصد سهم کارمند را انتخاب کنید
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">کارمند</Label>
              <Select value={employeeId} onValueChange={setEmployeeId} disabled={employeesLoading}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white mt-1">
                  <SelectValue placeholder="انتخاب کارمند" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">از تاریخ</Label>
              <PersianDatePicker
                value={fromDate}
                onChange={setFromDate}
                placeholder="۱۴۰۳/۰۱/۰۱"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">تا تاریخ</Label>
              <PersianDatePicker
                value={toDate}
                onChange={setToDate}
                placeholder="۱۴۰۳/۰۱/۳۱"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">درصد سهم کارمند</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white mt-1"
              />
            </div>
          </div>
          <Button
            onClick={handlePreview}
            disabled={loading || employeesLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'در حال بارگذاری...' : 'پیش‌نمایش'}
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">نتیجه پیش‌نمایش</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {preview.isServiceStaff
                ? `پرسنل خدمات — ${preview.tipAllocationCount ?? 0} تخصیص انعام`
                : preview.isSpecialCommission
                  ? `کمیسیون ویژه — مالیات ${formatTomansFromRial(preview.deductionPerAppointmentAmount)} سپس سهم ${preview.commissionPercentageUsed}٪`
                  : `درآمد سرویس فقط (بدون انعام) — کمیسیون ${preview.commissionPercentageUsed}٪`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {preview.lastCommissionSettlementAt && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                آخرین تسویه: {formatToJalali(preview.lastCommissionSettlementAt)}
                {preview.suggestedPeriodStartJalali && (
                  <> — پیشنهاد شروع دوره: {preview.suggestedPeriodStartJalali}</>
                )}
              </p>
            )}
            {preview.excludedAlreadySettledAppointments > 0 && (
              <p className="text-sm text-gray-500">
                {preview.excludedAlreadySettledAppointments} نوبت قبلاً در تسویه دیگری لحاظ شده و از این محاسبه حذف شدند.
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {preview.isServiceStaff ? 'تعداد تخصیص انعام' : 'تعداد نوبت‌ها'}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {preview.isServiceStaff
                    ? (preview.tipAllocationCount ?? 0)
                    : preview.totalAppointments}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {preview.isServiceStaff ? 'مجموع انعام' : 'مجموع درآمد'}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatTomansFromRial(preview.isServiceStaff ? preview.totalTipIncome ?? 0 : preview.totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">سهم کارمند (ناخالص)</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatTomansFromRial(preview.payoutGrossBeforeDeduction)}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">سهم پلتفرم</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {formatTomansFromRial(preview.platformShare)}
                </p>
              </div>
            </div>

            {!preview.isServiceStaff && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">کسورات هر نوبت</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {formatTomansFromRial(preview.deductionPerAppointmentAmount)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">مجموع کسورات نوبت</p>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {formatTomansFromRial(preview.totalDeduction)}
                </p>
              </div>
              <div className="rounded-lg border border-orange-300 dark:border-orange-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">برداشت‌های قبلی</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {formatTomansFromRial(preview.priorWithdrawalsTotal)}
                </p>
              </div>
              <div className="rounded-lg border border-green-300 dark:border-green-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Number(preview.netPayable) < 0
                    ? 'بدهی قابل تسویه (منفی)'
                    : 'قابل برداشت از سهم نوبت‌ها'}
                </p>
                <p
                  className={`text-xl font-bold ${
                    Number(preview.netPayable) < 0
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-green-700 dark:text-green-300'
                  }`}
                >
                  {formatTomansFromRial(preview.netPayable)}
                </p>
              </div>
            </div>
            )}

            {!preview.isServiceStaff && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Number(preview.teamShareIncome || 0) > 0 && (
              <div className="rounded-lg border border-teal-300 dark:border-teal-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">سهم انعام تیمی</p>
                <p className="text-xl font-bold text-teal-700 dark:text-teal-300">
                  {formatTomansFromRial(preview.teamShareIncome || '0')}
                </p>
              </div>
              )}
              <div className="rounded-lg border border-emerald-400 dark:border-emerald-600 p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
                <p className="text-sm text-gray-600 dark:text-gray-400">جمع قابل تسویه</p>
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                  {formatTomansFromRial(
                    preview.settlementPayable ?? preview.netPayable,
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  همان قابل برداشت از سهم نوبت‌ها (انعام فقط برای پرسنل خدمات است)
                </p>
              </div>
            </div>
            )}

            {preview.isServiceStaff && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border border-orange-300 dark:border-orange-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">برداشت‌های قبلی</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  {formatTomansFromRial(preview.priorWithdrawalsTotal)}
                </p>
              </div>
              <div className="rounded-lg border border-green-300 dark:border-green-700 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">خالص انعام قابل پرداخت</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {formatTomansFromRial(preview.netPayable)}
                </p>
              </div>
            </div>
            )}

            {preview.priorWithdrawals.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">برداشت‌های دوره</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>تاریخ</TableHead>
                      <TableHead>دسته</TableHead>
                      <TableHead>مبلغ</TableHead>
                      <TableHead>شرح</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.priorWithdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell>{formatToJalali(w.occurredAt)}</TableCell>
                        <TableCell>{w.categoryName || '-'}</TableCell>
                        <TableCell>{formatTomansFromRial(w.amount)}</TableCell>
                        <TableCell>{w.description || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {preview.breakdown.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {preview.isServiceStaff ? 'جزئیات انعام (روزانه)' : 'جزئیات نوبت‌ها'}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {isDailyBreakdown(preview.breakdown[0]) ? 'تاریخ' : 'هفته'}
                      </TableHead>
                      <TableHead>تعداد</TableHead>
                      <TableHead>درآمد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.breakdown.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          {isDailyBreakdown(row) ? row.date : row.weekLabel}
                        </TableCell>
                        <TableCell>{row.count}</TableCell>
                        <TableCell>
                          {formatTomansFromRial(row.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {preview.isServiceStaff && (
              <ServiceTipLinesTable
                tipLines={preview.tipLines ?? []}
                title="جزئیات انعام‌ها (نوبت و آرایشگر)"
              />
            )}

            {!preview.isServiceStaff &&
              Array.isArray(preview.appointments) &&
              preview.appointments.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  جزئیات نوبت‌ها (مالیات و سهم خالص)
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>نوبت</TableHead>
                      <TableHead>تاریخ</TableHead>
                      <TableHead>مشتری</TableHead>
                      <TableHead>مبلغ</TableHead>
                      <TableHead>مالیات</TableHead>
                      <TableHead>سهم خالص</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.appointments.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>#{a.id}</TableCell>
                        <TableCell>{a.scheduledAtJalali}</TableCell>
                        <TableCell>{a.customerName}</TableCell>
                        <TableCell>{formatTomansFromRial(a.amountRial)}</TableCell>
                        <TableCell>{formatTomansFromRial(a.taxApplied)}</TableCell>
                        <TableCell
                          className={
                            Number(a.netShare) < 0
                              ? 'text-red-600 dark:text-red-400'
                              : undefined
                          }
                        >
                          {formatTomansFromRial(a.netShare)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">ثبت تسویه</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>حساب بانکی پرداخت</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="انتخاب حساب" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="period-confirm"
                  checked={periodStartConfirmed}
                  onCheckedChange={(v) => setPeriodStartConfirmed(v === true)}
                />
                <Label htmlFor="period-confirm" className="cursor-pointer">
                  تاریخ شروع دوره ({fromDate}) را با آخرین تسویه تأیید می‌کنم
                </Label>
              </div>
              {!preview.isServiceStaff && (
                <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium tabular-nums">
                  مبلغ تسویه نهایی:{' '}
                  {formatTomansFromRial(
                    preview.settlementPayable ?? preview.netPayable,
                  )}
                  {Number(preview.teamShareIncome || 0) > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      (شامل سهم انعام تیمی{' '}
                      {formatTomansFromRial(preview.teamShareIncome || '0')})
                    </span>
                  )}
                </p>
              )}
              <Button
                onClick={handleCommit}
                disabled={committing}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {committing
                  ? 'در حال ثبت...'
                  : preview.isServiceStaff
                    ? 'ثبت تسویه نهایی'
                    : Number(
                          preview.settlementPayable ?? preview.netPayable,
                        ) < 0
                      ? `ثبت تسویه (بدهی ${formatTomansFromRial(
                          preview.settlementPayable ?? preview.netPayable,
                        )})`
                      : `ثبت تسویه نهایی (${formatTomansFromRial(
                          preview.settlementPayable ?? preview.netPayable,
                        )})`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">تاریخچه تسویه‌ها</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>بازه</TableHead>
                  <TableHead>نوبت‌ها</TableHead>
                  <TableHead>خالص پرداختی</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ ثبت</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>
                      {h.periodStartJalali || '-'} — {h.periodEndJalali || '-'}
                    </TableCell>
                    <TableCell>{h.appointmentCount}</TableCell>
                    <TableCell>{formatTomansFromRial(h.netPayableRial)}</TableCell>
                    <TableCell>
                      {h.status === 'ACTIVE' ? (
                        <span className="text-green-600">فعال</span>
                      ) : (
                        <span className="text-gray-500">برگشت‌شده</span>
                      )}
                    </TableCell>
                    <TableCell>{formatToJalali(h.settledAt)}</TableCell>
                    <TableCell>
                      {h.status === 'ACTIVE' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => handleReverse(h.id)}
                        >
                          برگشت
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
