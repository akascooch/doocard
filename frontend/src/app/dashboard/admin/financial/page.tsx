'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import {
  TrendingUp,
  BarChart3,
  Users,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/use-toast'
import {
  Bar,
  BarChart,
  ComposedChart,
  Line,
  Legend,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'
import axios from '@/lib/axios'
import { formatTomansFromRial } from '@/lib/money'
import {
  buildExpenseCategorySeries,
  CLEARED_CHEQUE_SERIES_LABEL,
  EXPENSE_OTHER_SERIES_LABEL,
  type ExpenseSeriesKey,
} from '@/lib/expense-category-series'
import { getCurrentJalaliYear } from '@/lib/date'
import {
  isFinancialAccessValid,
  setFinancialAccess,
  clearFinancialAccess,
} from '@/lib/financial-reports-access'

interface YearlyReportMonth {
  month: string
  expense: {
    total: string
    other?: string
    cheques?: string
    categories: Array<{ name: string; total: string; categoryId?: number | null }>
  }
  revenue: { total: string; appointmentCount?: number; employees: Array<{ name: string; count: number; amount: string }> }
}

interface YearlyReport {
  year: number
  months: YearlyReportMonth[]
  employeeRanking: Array<{ name: string; count: number; amount: string }>
}

interface TopCustomerRow {
  customerId: number
  name: string
  visitCount: number
  spendRial: string
  points: number
}

const DEFAULT_YEAR = getCurrentJalaliYear()

const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]

const EXPENSE_CATEGORY_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#f59e0b',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
]
const CHEQUE_SERIES_COLOR = '#94a3b8'

type ExpenseDrillItem = {
  id: number
  occurredAtJalali: string
  amountRial: string
  description: string | null
  sourceType: string | null
  categoryName: string | null
}

function seriesColor(series: ExpenseSeriesKey, index: number): string {
  if (series.kind === 'cheque') return CHEQUE_SERIES_COLOR
  return EXPENSE_CATEGORY_COLORS[index % EXPENSE_CATEGORY_COLORS.length]
}

export default function AdminFinancialPage() {
  const [yearlyReport, setYearlyReport] = useState<YearlyReport | null>(null)
  const [topCustomers, setTopCustomers] = useState<{
    spend: TopCustomerRow[]
    visits: TopCustomerRow[]
    points: TopCustomerRow[]
  } | null>(null)
  const [topMetric, setTopMetric] = useState<'spend' | 'visits' | 'points'>('spend')
  const [year, setYear] = useState(DEFAULT_YEAR)
  const [yearlyLoading, setYearlyLoading] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [gatePassword, setGatePassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [gateError, setGateError] = useState('')
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillTitle, setDrillTitle] = useState('')
  const [drillLoading, setDrillLoading] = useState(false)
  const [drillItems, setDrillItems] = useState<ExpenseDrillItem[]>([])
  const [drillSum, setDrillSum] = useState<string | null>(null)
  const [drillCount, setDrillCount] = useState<number | null>(null)
  const [drillOverflow, setDrillOverflow] = useState<Array<{ name: string; total: number }> | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    setIsUnlocked(isFinancialAccessValid())
  }, [])

  const handleFinancialApiError = useCallback((err: any) => {
    const status = err?.response?.status ?? err?.statusCode
    if (status === 403) {
      clearFinancialAccess()
      setIsUnlocked(false)
      setGateError('دسترسی منقضی شده است. دوباره رمز را وارد کنید.')
    }
  }, [])

  const fetchYearlyReport = useCallback(async () => {
    if (!isFinancialAccessValid()) return
    try {
      setYearlyLoading(true)
      const [reportRes, customersRes] = await Promise.all([
        axios.get(`/admin/financial/yearly-report?year=${year}`),
        axios.get(`/admin/analytics/top-customers`, { params: { year, limit: 10 } }).catch(() => null),
      ])
      setYearlyReport(reportRes.data)
      if (customersRes?.data) {
        setTopCustomers({
          spend: customersRes.data.spend || [],
          visits: customersRes.data.visits || [],
          points: customersRes.data.points || [],
        })
      }
    } catch (err) {
      console.error('Error fetching yearly report:', err)
      handleFinancialApiError(err)
      toast({ title: 'خطا', description: 'خطا در بارگذاری گزارش سالانه', variant: 'destructive' })
    } finally {
      setYearlyLoading(false)
    }
  }, [year, toast, handleFinancialApiError])

  const handleVerifyAccess = async () => {
    if (!gatePassword.trim()) {
      setGateError('لطفاً رمز عبور را وارد کنید.')
      return
    }
    setVerifying(true)
    setGateError('')
    try {
      const res = await axios.post('/admin/financial/verify-access', {
        password: gatePassword,
      })
      setFinancialAccess(res.data.accessToken, res.data.expiresIn ?? 900)
      setIsUnlocked(true)
      setGatePassword('')
    } catch (err: any) {
      const status = err?.response?.status ?? err?.statusCode
      const message = err?.response?.data?.message
      if (status === 403) {
        setGateError('ابتدا رمز گزارشات مالی را از تنظیمات ثبت کنید.')
      } else if (status === 401) {
        setGateError('رمز عبور اشتباه است.')
      } else {
        setGateError(message || 'خطا در تأیید رمز عبور')
      }
    } finally {
      setVerifying(false)
    }
  }

  useEffect(() => {
    if (isUnlocked) {
      fetchYearlyReport()
    }
  }, [isUnlocked, fetchYearlyReport])

  const openExpenseDrill = useCallback(
    async (monthName: string, series: ExpenseSeriesKey, overflow?: Array<{ name: string; total: number }>) => {
      const month = JALALI_MONTHS.indexOf(monthName) + 1
      setDrillOpen(true)
      setDrillTitle(`${series.name} — ${monthName} ${year}`)
      setDrillOverflow(series.kind === 'rest' ? overflow ?? [] : null)
      setDrillItems([])
      setDrillSum(null)
      setDrillCount(null)
      if (series.kind === 'rest') return
      if (month < 1) return
      try {
        setDrillLoading(true)
        const params: Record<string, string | number> = { year, month, bucket: series.kind, limit: 100 }
        if (series.kind === 'category' && series.categoryId != null) {
          params.categoryId = series.categoryId
        }
        const res = await axios.get('/admin/financial/expenses', { params })
        setDrillItems(res.data.items ?? [])
        setDrillSum(res.data.sumRial ?? null)
        setDrillCount(typeof res.data.count === 'number' ? res.data.count : null)
      } catch (err) {
        handleFinancialApiError(err)
        toast({ title: 'خطا', description: 'خطا در بارگذاری جزئیات هزینه', variant: 'destructive' })
      } finally {
        setDrillLoading(false)
      }
    },
    [year, toast, handleFinancialApiError],
  )

  if (!isUnlocked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>ورود به گزارشات مالی</CardTitle>
            <CardDescription>
              برای مشاهده گزارشات مالی، رمز تعیین‌شده در تنظیمات را وارد کنید.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="financial-gate-password">رمز عبور</Label>
              <PasswordInput
                id="financial-gate-password"
                value={gatePassword}
                onChange={(e) => setGatePassword(e.target.value)}
                placeholder="رمز گزارشات مالی"
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyAccess()}
              />
            </div>
            {gateError && (
              <p className="text-sm text-destructive">{gateError}</p>
            )}
            <Button
              className="w-full min-h-10"
              onClick={handleVerifyAccess}
              disabled={verifying}
            >
              {verifying ? 'در حال بررسی...' : 'تایید و ورود'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { series: expenseSeries, rows: expenseChartData } = buildExpenseCategorySeries(
    yearlyReport?.months ?? [],
  )

  const revenueChartData =
    yearlyReport?.months.map((m) => ({
      month: m.month,
      total: Number(m.revenue.total),
      appointmentCount: m.revenue.appointmentCount ?? 0,
      employees: m.revenue.employees,
    })) ?? []

  const rankingData =
    yearlyReport?.employeeRanking.map((r) => ({
      ...r,
      amountValue: Number(r.amount),
    })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground dark:text-foreground">گزارشات مالی</h1>
          <p className="text-foreground dark:text-foreground mt-2">
            گزارشات مالی، درآمد و هزینه‌های سالن زیبایی
          </p>
        </div>
      </div>

      {/* Year navigation + yearly charts */}
      <div className="flex items-center justify-between">
        <Card className="flex-1 max-w-xs">
          <CardContent className="pt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setYear((y) => y - 1)
              }}
              aria-label="سال قبل"
            >
              <ChevronRight className="h-4 w-4" />
              سال قبل
            </Button>
            <span className="text-lg font-bold tabular-nums">{year}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setYear((y) => y + 1)
              }}
              aria-label="سال بعد"
            >
              سال بعد
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {yearlyLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-border" />
        </div>
      ) : (
        <>
          {/* Chart 1 — Monthly Expenses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-foreground" />
                هزینه‌های ماهانه (سال {year})
              </CardTitle>
              <CardDescription>
                فروردین → اسفند. روی هر بخش کلیک کنید تا ریز هزینه‌ها را ببینید. چک وصول‌شده سری جداست.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expenseChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={expenseChartData}
                    margin={{ top: 16, right: 24, left: 16, bottom: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis
                      tickFormatter={(v) => {
                        const toman = Number(v) / 10
                        if (toman >= 1e6) return `${(toman / 1e6).toFixed(0)}M`
                        if (toman >= 1e3) return `${(toman / 1e3).toFixed(0)}K`
                        return String(Math.round(toman))
                      }}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0].payload as (typeof expenseChartData)[0]
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="font-medium mb-2">{row.month}</p>
                            <p className="text-sm text-foreground/80 mb-1">
                              کل: {formatTomansFromRial(row.total)}
                            </p>
                            <p className="text-xs mb-1">
                              {CLEARED_CHEQUE_SERIES_LABEL}: {formatTomansFromRial(row.cheques)}
                            </p>
                            {row.categories?.length > 0 && (
                              <ul className="text-xs space-y-1 mt-1">
                                {row.categories.map((c, i) => (
                                  <li key={i}>
                                    {c.name}: {formatTomansFromRial(c.total)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Legend />
                    {expenseSeries.map((s, i) => (
                      <Bar
                        key={s.key}
                        dataKey={s.key}
                        name={s.name}
                        stackId="expense"
                        fill={seriesColor(s, i)}
                        cursor="pointer"
                        radius={i === expenseSeries.length - 1 ? [4, 4, 0, 0] : undefined}
                        onClick={(data: { month?: string }) => {
                          const monthName = data?.month
                          if (!monthName) return
                          const row = expenseChartData.find((r) => r.month === monthName)
                          const overflow =
                            s.kind === 'rest'
                              ? (row?.categories ?? []).filter(
                                  (c) =>
                                    !expenseSeries.some(
                                      (ser) => ser.kind !== 'rest' && ser.kind !== 'cheque' && ser.name === c.name,
                                    ),
                                )
                              : undefined
                          void openExpenseDrill(monthName, s, overflow)
                        }}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-foreground/80">
                  داده‌ای برای این سال وجود ندارد
                </div>
              )}
              {expenseChartData.length > 0 && (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-right">
                        <th className="p-2 font-medium">ماه</th>
                        {expenseSeries.map((s) => (
                          <th key={s.key} className="p-2 font-medium whitespace-nowrap">
                            {s.name}
                          </th>
                        ))}
                        <th className="p-2 font-medium">کل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseChartData.map((row) => (
                        <tr key={row.month} className="border-b last:border-0">
                          <td className="p-2">{row.month}</td>
                          {expenseSeries.map((s) => (
                            <td key={s.key} className="p-2 tabular-nums">
                              {formatTomansFromRial(row[s.key] as number)}
                            </td>
                          ))}
                          <td className="p-2 tabular-nums font-medium">
                            {formatTomansFromRial(row.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{drillTitle}</DialogTitle>
                <DialogDescription>
                  {drillSum != null
                    ? `جمع: ${formatTomansFromRial(drillSum)}${drillCount != null ? ` — ${drillCount} ردیف` : ''}`
                    : EXPENSE_OTHER_SERIES_LABEL}
                </DialogDescription>
              </DialogHeader>
              {drillLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border" />
                </div>
              ) : drillOverflow ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-right">
                      <th className="p-2">دسته</th>
                      <th className="p-2">مبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillOverflow.map((row) => (
                      <tr key={row.name} className="border-b last:border-0">
                        <td className="p-2">{row.name}</td>
                        <td className="p-2 tabular-nums">{formatTomansFromRial(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-right">
                      <th className="p-2">تاریخ</th>
                      <th className="p-2">شرح</th>
                      <th className="p-2">مبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drillItems.length === 0 ? (
                      <tr>
                        <td className="p-4 text-center text-foreground/70" colSpan={3}>
                          ردیفی یافت نشد
                        </td>
                      </tr>
                    ) : (
                      drillItems.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="p-2 whitespace-nowrap">{item.occurredAtJalali}</td>
                          <td className="p-2">{item.description || item.categoryName || item.sourceType || '—'}</td>
                          <td className="p-2 tabular-nums">{formatTomansFromRial(item.amountRial)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </DialogContent>
          </Dialog>

          {/* Chart 2 — Monthly Revenue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-foreground" />
                درآمد ماهانه از نوبت‌ها (سال {year})
              </CardTitle>
              <CardDescription>
                مبلغ فروش تسویه‌شده (تومان) و حجم نوبت — همان فیلتر paidAt / تسویه‌شده
              </CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart
                    data={revenueChartData}
                    margin={{ top: 16, right: 24, left: 16, bottom: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="amount"
                      tickFormatter={(v) => {
                        const toman = Number(v) / 10
                        if (toman >= 1e6) return `${(toman / 1e6).toFixed(0)}M`
                        if (toman >= 1e3) return `${(toman / 1e3).toFixed(0)}K`
                        return String(Math.round(toman))
                      }}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="count"
                      orientation="right"
                      allowDecimals={false}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0].payload as (typeof revenueChartData)[0]
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="font-medium mb-2">{row.month}</p>
                            <p className="text-sm text-foreground/80 mb-1">
                              مبلغ فروش: {formatTomansFromRial(row.total)}
                            </p>
                            <p className="text-sm text-foreground/80 mb-1">
                              حجم نوبت: {row.appointmentCount}
                            </p>
                            {row.employees?.length > 0 && (
                              <ul className="text-xs space-y-1 mt-1">
                                {row.employees.map((e, i) => (
                                  <li key={i}>
                                    {e.name}: {e.count} نوبت
                                    {e.amount != null ? ` — ${formatTomansFromRial(e.amount)}` : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="amount"
                      dataKey="total"
                      name="مبلغ فروش"
                      fill="hsl(var(--chart-2))"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="appointmentCount"
                      name="حجم نوبت"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-foreground/80">
                  داده‌ای برای این سال وجود ندارد
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart 3 — Yearly Employee Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-foreground" />
                رتبه‌بندی کارمندان (کل سال {year})
              </CardTitle>
              <CardDescription>مرتب‌سازی بر اساس تعداد نوبت (نزولی)</CardDescription>
            </CardHeader>
            <CardContent>
              {rankingData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    layout="vertical"
                    data={rankingData}
                    margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as { name: string; count: number }
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-sm text-foreground/80">تعداد نوبت: {p.count}</p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="count" name="تعداد نوبت" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))">
                      {rankingData.map((_, i) => (
                        <Cell key={i} fill={`hsl(var(--primary))`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-foreground/80">
                  داده‌ای برای این سال وجود ندارد
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart 4 — Yearly Employee Sales Amount */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-foreground" />
                مبلغ فروش کل کارمندان (سال {year})
              </CardTitle>
              <CardDescription>مرتب‌سازی همان رتبه‌بندی تعداد نوبت؛ نمایش به تومان</CardDescription>
            </CardHeader>
            <CardContent>
              {rankingData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    layout="vertical"
                    data={rankingData}
                    margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => {
                        const toman = Number(v) / 10
                        if (toman >= 1e6) return `${(toman / 1e6).toFixed(0)}M`
                        if (toman >= 1e3) return `${(toman / 1e3).toFixed(0)}K`
                        return String(Math.round(toman))
                      }}
                    />
                    <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const p = payload[0].payload as { name: string; count: number; amount: string }
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-sm text-foreground/80">
                              مبلغ فروش (تومان): {formatTomansFromRial(p.amount)}
                            </p>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="amountValue" name="مبلغ فروش (تومان)" radius={[0, 4, 4, 0]} fill="hsl(var(--chart-2))" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-foreground/80">
                  داده‌ای برای این سال وجود ندارد
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-foreground" />
                مشتریان برتر (سال {year})
              </CardTitle>
              <CardDescription>مرتب‌سازی بر اساس مبلغ کل، تعداد مراجعه یا امتیاز وفاداری</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'spend', label: 'مبلغ کل' },
                    { id: 'visits', label: 'تعداد مراجعه' },
                    { id: 'points', label: 'امتیاز' },
                  ] as const
                ).map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    size="sm"
                    variant={topMetric === item.id ? 'default' : 'outline'}
                    onClick={() => setTopMetric(item.id)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              {(() => {
                const rows = topCustomers?.[topMetric] ?? []
                const chartRows = rows.map((row) => ({
                  name: row.name,
                  value:
                    topMetric === 'spend'
                      ? Number(row.spendRial)
                      : topMetric === 'visits'
                        ? row.visitCount
                        : row.points,
                }))
                return chartRows.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart
                      layout="vertical"
                      data={chartRows}
                      margin={{ top: 8, right: 24, left: 80, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null
                          const p = payload[0].payload as { name: string; value: number }
                          return (
                            <div className="rounded-lg border bg-background p-3 shadow-md">
                              <p className="font-medium">{p.name}</p>
                              <p className="text-sm text-foreground/80">
                                {topMetric === 'spend'
                                  ? formatTomansFromRial(p.value)
                                  : topMetric === 'visits'
                                    ? `${p.value} مراجعه`
                                    : `${p.value} امتیاز`}
                              </p>
                            </div>
                          )
                        }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-40 flex items-center justify-center text-foreground/80">
                    داده‌ای برای این سال وجود ندارد
                  </div>
                )
              })()}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
