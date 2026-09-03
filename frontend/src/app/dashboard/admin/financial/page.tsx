'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import {
  TrendingUp,
  Download,
  BarChart3,
  Users,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import {
  Bar,
  BarChart,
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
  isFinancialAccessValid,
  setFinancialAccess,
  clearFinancialAccess,
} from '@/lib/financial-reports-access'

interface YearlyReportMonth {
  month: string
  expense: { total: string; categories: Array<{ name: string; total: string }> }
  revenue: { total: string; employees: Array<{ name: string; count: number }> }
}

interface YearlyReport {
  year: number
  months: YearlyReportMonth[]
  employeeRanking: Array<{ name: string; count: number }>
}

const DEFAULT_YEAR = 1404

export default function AdminFinancialPage() {
  const [yearlyReport, setYearlyReport] = useState<YearlyReport | null>(null)
  const [year, setYear] = useState(DEFAULT_YEAR)
  const [yearlyLoading, setYearlyLoading] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [gatePassword, setGatePassword] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [gateError, setGateError] = useState('')
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
      const res = await axios.get(`/admin/financial/yearly-report?year=${year}`)
      setYearlyReport(res.data)
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

  const expenseChartData =
    yearlyReport?.months.map((m) => ({
      month: m.month,
      total: Number(m.expense.total),
      categories: m.expense.categories,
    })) ?? []

  const revenueChartData =
    yearlyReport?.months.map((m) => ({
      month: m.month,
      total: Number(m.revenue.total),
      employees: m.revenue.employees,
    })) ?? []

  const rankingData = yearlyReport?.employeeRanking ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">گزارشات مالی</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            گزارشات مالی، درآمد و هزینه‌های سالن زیبایی
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline">
            <Download className="h-4 w-4 ml-2" />
            خروجی Excel
          </Button>
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
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-main-orange" />
        </div>
      ) : (
        <>
          {/* Chart 1 — Monthly Expenses */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-main-orange" />
                هزینه‌های ماهانه (سال {year})
              </CardTitle>
              <CardDescription>فروردین → اسفند، با تفکیک دسته (در tooltip)</CardDescription>
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
                    <Bar dataKey="total" name="هزینه (تومان)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-foreground/80">
                  داده‌ای برای این سال وجود ندارد
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chart 2 — Monthly Revenue */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                درآمد ماهانه از نوبت‌ها (سال {year})
              </CardTitle>
              <CardDescription>فروردین → اسفند، با تفکیک کارمند (در tooltip)</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={revenueChartData}
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
                        const row = payload[0].payload as (typeof revenueChartData)[0]
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-md">
                            <p className="font-medium mb-2">{row.month}</p>
                            <p className="text-sm text-foreground/80 mb-1">
                              کل: {formatTomansFromRial(row.total)}
                            </p>
                            {row.employees?.length > 0 && (
                              <ul className="text-xs space-y-1 mt-1">
                                {row.employees.map((e, i) => (
                                  <li key={i}>
                                    {e.name}: {e.count} نوبت
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="total" name="درآمد (تومان)" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
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
                <Users className="h-5 w-5 text-main-orange" />
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
        </>
      )}
    </div>
  )
}
