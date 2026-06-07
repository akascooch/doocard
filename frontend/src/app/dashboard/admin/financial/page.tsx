"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  BarChart3,
  PieChart,
  FileText,
  Users,
  Scissors,
  Clock,
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
  Legend,
  Cell,
} from 'recharts'
import axios from '@/lib/axios'
import { toThousandTomans } from '@/lib/money'

interface FinancialData {
  totalRevenue: number
  monthlyRevenue: number
  dailyRevenue: number
  totalExpenses: number
  netProfit: number
  totalCustomers: number
  totalAppointments: number
  averageAppointmentValue: number
  topServices: Array<{ name: string; revenue: number; bookings: number }>
  recentTransactions: Array<{
    id: number
    type: string
    amount: number | string
    description: string
    date: string
    category: string
  }>
}

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
  const [financialData, setFinancialData] = useState<FinancialData | null>(null)
  const [yearlyReport, setYearlyReport] = useState<YearlyReport | null>(null)
  const [year, setYear] = useState(DEFAULT_YEAR)
  const [loading, setLoading] = useState(true)
  const [yearlyLoading, setYearlyLoading] = useState(true)
  const [dateRange, setDateRange] = useState('month')
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const { toast } = useToast()

  const fetchFinancialData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await axios.get('/dashboard/financial-stats')
      setFinancialData(res.data)
    } catch (err) {
      console.error('Error fetching financial data:', err)
      toast({ title: 'خطا', description: 'خطا در بارگذاری اطلاعات مالی', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchYearlyReport = useCallback(async () => {
    try {
      setYearlyLoading(true)
      const res = await axios.get(`/admin/financial/yearly-report?year=${year}`)
      setYearlyReport(res.data)
    } catch (err) {
      console.error('Error fetching yearly report:', err)
      toast({ title: 'خطا', description: 'خطا در بارگذاری گزارش سالانه', variant: 'destructive' })
    } finally {
      setYearlyLoading(false)
    }
  }, [year, toast])

  useEffect(() => {
    fetchFinancialData()
  }, [fetchFinancialData, dateRange, selectedMonth])

  useEffect(() => {
    fetchYearlyReport()
  }, [fetchYearlyReport])

  const formatDate = (date: string) => new Date(date).toLocaleDateString('fa-IR')

  const isIncome = (type: string) => type === 'INCOME'
  const getTransactionIcon = (type: string) =>
    isIncome(type) ? (
      <TrendingUp className="h-4 w-4 text-green-600" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-600" />
    )
  const getTransactionColor = (type: string) => (isIncome(type) ? 'text-green-600' : 'text-red-600')

  const amountValue = (amount: number | string) =>
    typeof amount === 'string' ? Number(amount) : amount

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main-orange" />
      </div>
    )
  }

  if (!financialData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">اطلاعات مالی در دسترس نیست</p>
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
          <Select defaultValue={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">روزانه</SelectItem>
              <SelectItem value="week">هفتگی</SelectItem>
              <SelectItem value="month">ماهانه</SelectItem>
              <SelectItem value="year">سالانه</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 ml-2" />
            خروجی Excel
          </Button>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل درآمد</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {toThousandTomans(financialData.totalRevenue)}
            </div>
            <p className="text-xs text-foreground/80">از ابتدای فعالیت</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">درآمد ماهانه</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {toThousandTomans(financialData.monthlyRevenue)}
            </div>
            <p className="text-xs text-foreground/80">این ماه</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل هزینه‌ها</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {toThousandTomans(financialData.totalExpenses)}
            </div>
            <p className="text-xs text-foreground/80">از ابتدای فعالیت</p>
          </CardContent>
        </Card>

        <Card className="border-main-orange/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">سود خالص</CardTitle>
            <BarChart3 className="h-4 w-4 text-main-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-main-orange">
              {toThousandTomans(financialData.netProfit)}
            </div>
            <p className="text-xs text-foreground/80">سود خالص</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">درآمد روزانه</CardTitle>
            <Calendar className="h-4 w-4 text-main-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {toThousandTomans(financialData.dailyRevenue)}
            </div>
            <p className="text-xs text-foreground/80">امروز</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل مشتریان</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialData.totalCustomers}</div>
            <p className="text-xs text-foreground/80">مشتری فعال</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل نوبت‌ها</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialData.totalAppointments}</div>
            <p className="text-xs text-foreground/80">نوبت تکمیل شده</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">میانگین ارزش نوبت</CardTitle>
            <Scissors className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {toThousandTomans(financialData.averageAppointmentValue)}
            </div>
            <p className="text-xs text-foreground/80">میانگین</p>
          </CardContent>
        </Card>
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
                      tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : String(v))}
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
                              کل: {toThousandTomans(row.total)}
                            </p>
                            {row.categories?.length > 0 && (
                              <ul className="text-xs space-y-1 mt-1">
                                {row.categories.map((c, i) => (
                                  <li key={i}>
                                    {c.name}: {toThousandTomans(Number(c.total))}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="total" name="هزینه (ریال)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
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
                      tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(0)}M` : String(v))}
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
                              کل: {toThousandTomans(row.total)}
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
                    <Bar dataKey="total" name="درآمد (ریال)" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
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

      {/* Top Services */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5 text-main-orange" />
            پرفروش‌ترین خدمات
          </CardTitle>
          <CardDescription>خدمات با بیشترین درآمد</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {financialData.topServices.map((service, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-main-orange/20 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-main-orange">{index + 1}</span>
                  </div>
                  <div>
                    <div className="font-medium">{service.name}</div>
                    <div className="text-sm text-gray-500">{service.bookings} رزرو</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">{toThousandTomans(service.revenue)}</div>
                  <div className="text-sm text-gray-500">درآمد</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-main-orange" />
            تراکنش‌های اخیر
          </CardTitle>
          <CardDescription>آخرین تراکنش‌های مالی</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نوع</TableHead>
                  <TableHead>توضیحات</TableHead>
                  <TableHead>دسته‌بندی</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {financialData.recentTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTransactionIcon(transaction.type)}
                        <Badge
                          variant="outline"
                          className={
                            isIncome(transaction.type)
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }
                        >
                          {isIncome(transaction.type) ? 'درآمد' : 'هزینه'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{transaction.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaction.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${getTransactionColor(transaction.type)}`}>
                        {isIncome(transaction.type) ? '+' : '-'}
                        {toThousandTomans(amountValue(transaction.amount))}
                      </span>
                    </TableCell>
                    <TableCell>{formatDate(transaction.date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-800">خلاصه درآمد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>کل درآمد:</span>
                <span className="font-bold">{toThousandTomans(financialData.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>درآمد ماهانه:</span>
                <span className="font-bold">{toThousandTomans(financialData.monthlyRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>درآمد روزانه:</span>
                <span className="font-bold">{toThousandTomans(financialData.dailyRevenue)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800">خلاصه هزینه‌ها</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>کل هزینه‌ها:</span>
                <span className="font-bold">{toThousandTomans(financialData.totalExpenses)}</span>
              </div>
              <div className="flex justify-between">
                <span>هزینه‌های جاری:</span>
                <span className="font-bold">
                  {toThousandTomans(financialData.totalExpenses * 0.3)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>مواد اولیه:</span>
                <span className="font-bold">
                  {toThousandTomans(financialData.totalExpenses * 0.4)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-main-orange/10 border-main-orange/20">
          <CardHeader>
            <CardTitle className="text-main-orange">خلاصه سود</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>سود خالص:</span>
                <span className="font-bold text-green-600">
                  {toThousandTomans(financialData.netProfit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>نرخ سود:</span>
                <span className="font-bold text-green-600">
                  {financialData.totalRevenue
                    ? ((financialData.netProfit / financialData.totalRevenue) * 100).toFixed(1)
                    : 0}
                  %
                </span>
              </div>
              <div className="flex justify-between">
                <span>میانگین سود ماهانه:</span>
                <span className="font-bold text-green-600">
                  {toThousandTomans(financialData.netProfit / 12)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
