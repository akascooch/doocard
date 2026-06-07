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
  TrendingUp,
  CheckCircle,
  AlertCircle,
  User,
  Scissors,
  Star
} from 'lucide-react'
import { format } from 'date-fns'
import { faIR } from 'date-fns/locale'
import { getCurrentUser } from '@/lib/auth'
import axios from '@/lib/axios'

interface EmployeeStats {
  todayAppointments: number
  completedAppointments: number
  pendingAppointments: number
  monthlyEarnings: number
  totalCustomers: number
  averageRating: number
}

interface TodayAppointment {
  id: number
  appointmentDate: string
  status: string
  service: {
    name: string
    price: number
    durationMinutes: number
  }
  customer: {
    user: {
      name: string
      phone: string
    }
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
    averageRating: 0
  })
  const [todayAppointments, setTodayAppointments] = useState<TodayAppointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      if (currentUser.role !== 'EMPLOYEE') {
        router.push(`/dashboard/${currentUser.role.toLowerCase()}`)
        return
      }
    }
    fetchEmployeeData()
  }, [])

  const fetchEmployeeData = async () => {
    try {
      const token = localStorage.getItem('token')
      // Fetch employee stats from real database
      const [statsResponse, appointmentsResponse] = await Promise.all([
        fetch('/api/dashboard/employee-stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch('/api/dashboard/employee-today-appointments', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json()
        setTodayAppointments(appointmentsData)
      }
    } catch (error) {
      console.error('Error fetching employee data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">در انتظار</Badge>
      case 'CONFIRMED':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">تأیید شده</Badge>
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800">تکمیل شده</Badge>
      case 'CANCELLED':
        return <Badge variant="destructive">لغو شده</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'CONFIRMED':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'CANCELLED':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          خوش آمدید، {user?.name}
        </h2>
        <div className="flex items-center space-x-2 space-x-reverse">
          <Button onClick={() => router.push('/dashboard/employee/appointments')}>
            <Calendar className="h-4 w-4 mr-2" />
            مدیریت نوبت‌ها
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نوبت‌های امروز</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayAppointments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedAppointments} تکمیل شده
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">درآمد ماهانه</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.monthlyEarnings.toLocaleString('fa-IR')} تومان
            </div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1" />
              +12% نسبت به ماه قبل
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل مشتریان</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              مشتریان فعال
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">میانگین امتیاز</CardTitle>
            <Star className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averageRating}</div>
            <p className="text-xs text-muted-foreground">
              از ۵ امتیاز
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            نوبت‌های امروز
          </CardTitle>
          <CardDescription>
            {format(new Date(), 'PPP', { locale: faIR })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {todayAppointments.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">نوبتی برای امروز ندارید</h3>
              <p className="text-muted-foreground">
                می‌توانید نوبت‌های آینده را در بخش مدیریت نوبت‌ها مشاهده کنید
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {todayAppointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <div className="flex-shrink-0">
                      {getStatusIcon(appointment.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-medium">{appointment.service?.name || 'خدمت'}</h4>
                        {getStatusBadge(appointment.status)}
                      </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {appointment.appointmentDate 
                            ? (() => {
                                try {
                                  return format(new Date(appointment.appointmentDate), 'HH:mm');
                                } catch {
                                  return '--:--';
                                }
                              })()
                            : '--:--'
                          }
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {appointment.customer?.user?.name || 'مشتری'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Scissors className="h-3 w-3" />
                          {appointment.service?.durationMinutes || 0} دقیقه
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-primary">
                      {appointment.service?.price?.toLocaleString('fa-IR') || '0'} تومان
                    </div>
                    {appointment.status === 'PENDING' && (
                      <Button size="sm" className="mt-2">
                        تأیید نوبت
                      </Button>
                    )}
                    {appointment.status === 'CONFIRMED' && (
                      <Button size="sm" variant="outline" className="mt-2">
                        شروع خدمت
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>عملیات سریع</CardTitle>
          <CardDescription>
            دسترسی سریع به بخش‌های مهم
          </CardDescription>
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
              onClick={() => router.push('/dashboard/employee/earnings')}
            >
              <DollarSign className="h-6 w-6" />
              <span>درآمدها</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/employee/customers')}
            >
              <Users className="h-6 w-6" />
              <span>مشتریان</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/employee/settings')}
            >
              <User className="h-6 w-6" />
              <span>تنظیمات</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}