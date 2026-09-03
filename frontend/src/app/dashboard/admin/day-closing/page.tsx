"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { 
  Calendar, 
  Lock, 
  Unlock, 
  RefreshCw, 
  DollarSign, 
  Users, 
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import { PersianDatePicker } from '@/components/ui/persian-date-picker'
import { formatTomansFromRial } from '@/lib/money'

interface DayClosingData {
  id: number
  date: string
  totalIncome: number
  totalExpense: number
  totalTips: number
  totalSalaries: number
  isClosed: boolean
  closedAt?: string
  closedBy?: number
  closedByUser?: {
    name: string
  }
  totalAppointments: number
  completedAppointments: number
  pendingAppointments: number
}

export default function DayClosingPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [dayClosingData, setDayClosingData] = useState<DayClosingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchDayClosingData()
  }, [selectedDate])

  const fetchDayClosingData = async () => {
    try {
      setLoading(true)
      const dateStr = selectedDate.toISOString().split('T')[0]
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/day-closing/${dateStr}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setDayClosingData(data)
      } else {
        throw new Error('Failed to fetch day closing data')
      }
    } catch (error) {
      console.error('Error fetching day closing data:', error)
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری اطلاعات روز',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCloseDay = async () => {
    try {
      setClosing(true)
      const dateStr = selectedDate.toISOString().split('T')[0]
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/day-closing/${dateStr}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        toast({
          title: 'موفقیت',
          description: 'روز با موفقیت بسته شد',
        })
        fetchDayClosingData()
      } else {
        throw new Error('Failed to close day')
      }
    } catch (error) {
      console.error('Error closing day:', error)
      toast({
        title: 'خطا',
        description: 'خطا در بستن روز',
        variant: 'destructive',
      })
    } finally {
      setClosing(false)
    }
  }

  const handleReopenDay = async () => {
    try {
      setReopening(true)
      const dateStr = selectedDate.toISOString().split('T')[0]
      const token = localStorage.getItem('token')
      
      const response = await fetch(`/api/day-closing/${dateStr}/reopen`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        toast({
          title: 'موفقیت',
          description: 'روز با موفقیت باز شد',
        })
        fetchDayClosingData()
      } else {
        throw new Error('Failed to reopen day')
      }
    } catch (error) {
      console.error('Error reopening day:', error)
      toast({
        title: 'خطا',
        description: 'خطا در باز کردن روز',
        variant: 'destructive',
      })
    } finally {
      setReopening(false)
    }
  }


  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fa-IR')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">بستن روز</h1>
          <p className="text-muted-foreground">
            مدیریت بستن روز و محاسبه درآمد و هزینه‌ها
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchDayClosingData}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 ml-2" />
            بازخوانی
          </Button>
        </div>
      </div>

      {/* Date Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            انتخاب تاریخ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <PersianDatePicker
              value={selectedDate}
              onChange={(date) => {
                if (date) {
                  setSelectedDate(date)
                }
              }}
            />
            <Badge variant={dayClosingData?.isClosed ? "destructive" : "default"}>
              {dayClosingData?.isClosed ? 'بسته شده' : 'باز'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {dayClosingData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">کل درآمد</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatTomansFromRial(dayClosingData.totalIncome)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">کل هزینه</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatTomansFromRial(dayClosingData.totalExpense)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">کل انعام</CardTitle>
                <DollarSign className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">
                  {formatTomansFromRial(dayClosingData.totalTips)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">کل حقوق</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatTomansFromRial(dayClosingData.totalSalaries)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  آمار قرار ملاقات‌ها
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">کل قرار ملاقات‌ها:</span>
                  <Badge variant="outline">{dayClosingData.totalAppointments}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">تکمیل شده:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {dayClosingData.completedAppointments}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">در انتظار:</span>
                  <Badge variant="default" className="bg-yellow-100 text-yellow-800">
                    {dayClosingData.pendingAppointments}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  وضعیت روز
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">وضعیت:</span>
                  <Badge variant={dayClosingData.isClosed ? "destructive" : "default"}>
                    {dayClosingData.isClosed ? 'بسته شده' : 'باز'}
                  </Badge>
                </div>
                {dayClosingData.isClosed && dayClosingData.closedAt && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">زمان بستن:</span>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(dayClosingData.closedAt)}
                      </span>
                    </div>
                    {dayClosingData.closedByUser && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">بسته شده توسط:</span>
                        <span className="text-sm text-muted-foreground">
                          {dayClosingData.closedByUser.name}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Buttons */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {dayClosingData.isClosed ? (
                  <Lock className="h-5 w-5 text-red-600" />
                ) : (
                  <Unlock className="h-5 w-5 text-green-600" />
                )}
                عملیات روز
              </CardTitle>
              <CardDescription>
                {dayClosingData.isClosed 
                  ? 'این روز بسته شده است. در صورت نیاز می‌توانید آن را باز کنید.'
                  : 'برای بستن روز و محاسبه نهایی درآمد و هزینه‌ها، روی دکمه بستن روز کلیک کنید.'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {dayClosingData.isClosed ? (
                  <Button
                    onClick={handleReopenDay}
                    disabled={reopening}
                    variant="outline"
                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                  >
                    <Unlock className="h-4 w-4 ml-2" />
                    {reopening ? 'در حال باز کردن...' : 'باز کردن روز'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleCloseDay}
                    disabled={closing}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <Lock className="h-4 w-4 ml-2" />
                    {closing ? 'در حال بستن...' : 'بستن روز'}
                  </Button>
                )}
              </div>
              
              {!dayClosingData.isClosed && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">توجه:</p>
                      <p>پس از بستن روز، امکان ویرایش یا حذف قرار ملاقات‌ها و تراکنش‌های آن روز وجود نخواهد داشت.</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
