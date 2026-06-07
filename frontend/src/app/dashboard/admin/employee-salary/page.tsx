'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
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
import { formatCompactMoney } from '@/lib/money'

interface Employee {
  id: number
  name: string
}

interface PreviewResult {
  totalAppointments: number
  totalRevenue: string
  employeeShare: string
  platformShare: string
  breakdown: Array<
    | { date: string; count: number; revenue: string }
    | { weekLabel: string; count: number; revenue: string }
  >
}

function isDailyBreakdown(
  b: PreviewResult['breakdown'][0],
): b is { date: string; count: number; revenue: string } {
  return 'date' in b
}

export default function EmployeeSalaryPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeeId, setEmployeeId] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [percentage, setPercentage] = useState<string>('40')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const { toast } = useToast()

  const fetchEmployees = useCallback(async () => {
    try {
      setEmployeesLoading(true)
      const res = await axios.get('/employees')
      const list = (res.data || []).map((e: { id: number; user?: { name: string }; name?: string }) => ({
        id: e.id,
        name: e.user?.name ?? e.name ?? `کارمند #${e.id}`,
      }))
      setEmployees(list)
      if (list.length > 0 && !employeeId) {
        setEmployeeId(String(list[0].id))
      }
    } catch (err) {
      console.error(err)
      toast({ title: 'خطا', description: 'بارگذاری لیست کارکنان ناموفق بود', variant: 'destructive' })
    } finally {
      setEmployeesLoading(false)
    }
  }, [employeeId, toast])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

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
      const res = await axios.get('/admin/employee-salary/preview', {
        params: { employeeId, from: fromDate, to: toDate, percentage: pct },
      })
      setPreview(res.data)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'خطا در دریافت پیش‌نمایش'
      toast({ title: 'خطا', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">حقوق کارمندان</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          محاسبه سهم کارمند و پلتفرم بر اساس نوبت‌های تسویه‌شده (بدون انعام)
        </p>
      </div>

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
            <CardTitle className="text-gray-900 dark:text-white">نتیجه</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              مجموع نوبت‌ها و درآمد (سرویس فقط، بدون انعام)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">تعداد نوبت‌ها</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{preview.totalAppointments}</p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">مجموع درآمد (ریال)</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {formatCompactMoney(Number(preview.totalRevenue))}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">سهم کارمند</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  {formatCompactMoney(Number(preview.employeeShare))}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">سهم پلتفرم</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCompactMoney(Number(preview.platformShare))}
                </p>
              </div>
            </div>

            {preview.breakdown.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">جزئیات</h3>
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
                          {formatCompactMoney(Number(row.revenue))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
