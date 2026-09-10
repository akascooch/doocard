"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Calendar,
  Clock,
  Users,
  DollarSign,
  CheckCircle,
  AlertCircle,
  User,
  Scissors,
  BarChart3,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { canAccessEmployeeDashboard, getDashboardHomePath } from '@/lib/user-roles'
import { formatTomansFromRial } from '@/lib/money'
import { formatToJalali } from '@/lib/date'

interface EmployeeStats {
  todayAppointments: number
  todayCompletedAppointments?: number
  todayPendingAppointments?: number
  completedAppointments: number
  pendingAppointments: number
  monthlyNetEarningsRial?: string
  monthlyEarnings: number
  totalCustomers: number
  averageRating: number | null
}

interface TodayAppointment {
  id: number
  scheduledAt?: string
  appointmentDate?: string
  status: string
  durationMin?: number
  serviceName?: string
  customerName?: string
  service?: {
    name: string
    durationMinutes?: number
  }
  customer?: {
    user: {
      name: string
      phone: string
    }
  }
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'در انتظار', className: 'bg-yellow-100 text-yellow-800' },
  PENDING_CONFIRMATION: { label: 'در انتظار تأیید', className: 'bg-yellow-100 text-yellow-800' },
  CONFIRMED: { label: 'تأیید شده', className: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'انجام شده', className: 'bg-green-100 text-green-800' },
  SETTLED: { label: 'تسویه شده', className: 'bg-green-100 text-green-800' },
  PAID: { label: 'پرداخت شده', className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'لغو شده', className: 'bg-red-100 text-red-800' },
}

function formatTehranTime(iso?: string) {
  if (!iso) return '--:--'
  try {
    return new Date(iso).toLocaleTimeString('fa-IR', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return '--:--'
  }
}

export default function EmployeeDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<EmployeeStats>({
    todayAppointments: 0,
    completedAppointments: 0,
    pendingAppointments: 0,
    monthlyEarnings: 0,
    totalCustomers: 0,
    averageRating: null,
  })
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      if (!canAccessEmployeeDashboard(currentUser.role)) {
        router.replace(getDashboardHomePath(currentUser.role))
        return
      }
    }
    fetchEmployeeData()
  }, [])

  const fetchEmployeeData = async () => {
    try {
      const token = localStorage.getItem('token')
      const [statsResponse, appointmentsResponse] = await Promise.all([
        fetch('/api/dashboard/employee-stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/dashboard/employee-today-appointments', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ])

      if (statsResponse.ok) {
        setStats(await statsResponse.json())
      }
      if (appointmentsResponse.ok) {
        setTodayAppointments(await appointmentsResponse.json())
      }
    } catch (error) {
      console.error('Error fetching employee data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const meta = STATUS_LABEL[status] || { label: status, className: '' }
    return (
      <Badge variant="outline" className={meta.className}>
        {meta.label}
      </Badge>
    )
  }

  const todayCompleted = stats.todayCompletedAppointments ?? stats.completedAppointments
  const todayPending = stats.todayPendingAppointments ?? stats.pendingAppointments
  const monthlyRial = stats.monthlyNetEarningsRial ?? String(Math.round((stats.monthlyEarnings || 0) * 10))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-8 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          خوش آمدید، {user?.name}
        </h2>
        <Button onClick={() => router.push('/dashboard/employee/appointments')}>
          <Calendar className="h-4 w-4 ml-2" />
          مدیریت نوبت‌ها
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نوبت‌های امروز</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAppointments.toLocaleString('fa-IR')}</div>
            <p className="text-xs text-muted-foreground">
              {todayCompleted.toLocaleString('fa-IR')} انجام‌شده · {todayPending.toLocaleString('fa-IR')} در انتظار
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">سهم خالص این ماه</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{formatTomansFromRial(monthlyRial)}</div>
            <p className="text-xs text-muted-foreground">از نوبت‌های تسویه‌شده ماه جاری</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مشتریان</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers.toLocaleString('fa-IR')}</div>
            <p className="text-xs text-muted-foreground">مشتریان با حداقل یک نوبت</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">گزارش عملکرد</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full mt-1"
              onClick={() => router.push('/dashboard/employee/performance')}
            >
              مشاهده گزارش ۵ساله
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            نوبت‌های امروز
          </CardTitle>
          <CardDescription>{formatToJalali(new Date())}</CardDescription>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">نوبتی برای امروز ندارید</h3>
              <p className="text-muted-foreground">
                نوبت‌های دیگر را از بخش مدیریت نوبت‌ها ببینید
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayAppointments.map((appointment) => {
                const when = appointment.scheduledAt || appointment.appointmentDate
                return (
                  <div
                    key={appointment.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg"
                  >
                    <div className="flex items-start gap-3">
                      {appointment.status === 'CANCELLED' ? (
                        <AlertCircle className="h-4 w-4 text-red-600 mt-1" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-primary mt-1" />
                      )}
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium">
                            {appointment.serviceName || appointment.service?.name || 'خدمت'}
                          </h4>
                          {getStatusBadge(appointment.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTehranTime(when)}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {appointment.customerName || appointment.customer?.user?.name || 'مشتری'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Scissors className="h-3 w-3" />
                            {appointment.durationMin || appointment.service?.durationMinutes || 0} دقیقه
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>عملیات سریع</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/employee/appointments')}
            >
              <Calendar className="h-6 w-6" />
              <span>نوبت‌های من</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/employee/salary-request')}
            >
              <DollarSign className="h-6 w-6" />
              <span>درخواست حقوق</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/employee/my-customers')}
            >
              <Users className="h-6 w-6" />
              <span>مشتریان من</span>
            </Button>
            <Button
              variant="outline"
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/employee/performance')}
            >
              <BarChart3 className="h-6 w-6" />
              <span>گزارش عملکرد</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
