"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  UserPlus,
  History,
  Star,
  CalendarPlus,
  Sparkles
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { formatJalaliDateTime } from '@/lib/date'
import { BookingModal } from '@/components/booking/BookingModal'

interface CustomerStats {
  totalAppointments: number
  upcomingAppointments: number
  completedAppointments: number
  cancelledAppointments: number
  totalSpent?: number
  nextAppointment?: {
    id: number
    date: string
    service: string
    employee: string
    status: string
  }
}

export default function CustomerDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState<CustomerStats>({
    totalAppointments: 0,
    upcomingAppointments: 0,
    completedAppointments: 0,
    cancelledAppointments: 0
  })
  const [loading, setLoading] = useState(true)
  const [bookingModalOpen, setBookingModalOpen] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      // Check if user is customer
      if (currentUser.role !== 'CUSTOMER') {
        // Redirect to appropriate dashboard
        window.location.href = `/dashboard/${currentUser.role.toLowerCase()}`
        return
      }
    }
    
    // Fetch customer dashboard stats
    fetchCustomerStats()
    fetchProfile()
  }, [])

  const fetchCustomerStats = async () => {
    try {
      const token = localStorage.getItem('token')
      // Fetch customer stats from real database
      const [statsResponse, appointmentsResponse] = await Promise.all([
        fetch('/api/dashboard/customer-stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch('/api/dashboard/customer-upcoming-appointments', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      ])

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats({
          totalAppointments: statsData.totalAppointments,
          upcomingAppointments: statsData.upcomingAppointments,
          completedAppointments: statsData.completedAppointments,
          cancelledAppointments: 0, // This would need to be calculated separately
          totalSpent: statsData.totalSpent
        })
      }

      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json()
        if (appointmentsData.length > 0) {
          const nextAppointment = appointmentsData[0]
          const serviceName =
            nextAppointment?.serviceName ??
            nextAppointment?.service?.name ??
            'نام سرویس مشخص نیست'
          const employeeName =
            nextAppointment?.employeeName ??
            nextAppointment?.employee?.user?.name ??
            'آرایشگر نامشخص'
          const appointmentDate =
            nextAppointment?.appointmentDate ?? nextAppointment?.scheduledAt
          setStats(prev => ({
            ...prev,
            nextAppointment: {
              id: nextAppointment.id,
              date: appointmentDate,
              service: serviceName,
              employee: employeeName,
              status: nextAppointment.status
            }
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching customer stats:', error)
      setStats({
        totalAppointments: 0,
        upcomingAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return
      const res = await fetch('/api/customers/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
      }
    } catch (e) {}
  }

  // Date formatting now uses Jalali calendar
  const formatDate = (dateString: string) => {
    return formatJalaliDateTime(dateString)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main-orange"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            داشبورد مشتری
          </h1>
          <p className="text-muted-foreground mt-2">
            خوش آمدید، {user?.name}
          </p>
        </div>
        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
          مشتری
        </Badge>
      </div>

      {/* Hero CTA - New Booking Button */}
      <Card className="relative overflow-hidden border-0 shadow-2xl bg-gradient-to-br from-teal via-light-blue to-main-orange">
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
        <CardContent className="relative p-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 animate-pulse" />
                <h2 className="text-2xl md:text-3xl font-bold">
                  آماده برای رزرو نوبت جدید هستید؟
                </h2>
              </div>
              <p className="text-white/90 text-lg">
                با چند کلیک ساده، نوبت خود را در سریع‌ترین زمان ممکن رزرو کنید
              </p>
            </div>
            <Button
              size="lg"
              onClick={() => setBookingModalOpen(true)}
              className="bg-white text-black hover:bg-white/90 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 text-lg px-8 py-6 h-auto font-bold"
            >
              <CalendarPlus className="w-6 h-6 ml-2" />
              رزرو نوبت جدید
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Booking Modal */}
      <BookingModal
        open={bookingModalOpen}
        onOpenChange={setBookingModalOpen}
        onSuccess={() => {
          fetchCustomerStats()
          fetchProfile()
        }}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-main-orange/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل نوبت‌ها</CardTitle>
            <Calendar className="h-4 w-4 text-main-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAppointments}</div>
            <p className="text-xs text-muted-foreground">
              از ابتدای عضویت
            </p>
          </CardContent>
        </Card>

        <Card className="border-teal/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نوبت‌های آینده</CardTitle>
            <Clock className="h-4 w-4 text-teal" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingAppointments}</div>
            <p className="text-xs text-muted-foreground">
              برنامه‌ریزی شده
            </p>
          </CardContent>
        </Card>

        <Card className="border-light-blue/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تکمیل شده</CardTitle>
            <CheckCircle className="h-4 w-4 text-light-blue" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedAppointments}</div>
            <p className="text-xs text-muted-foreground">
              نوبت‌های انجام شده
            </p>
          </CardContent>
        </Card>

        <Card className="border-main-orange/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">لغو شده</CardTitle>
            <AlertCircle className="h-4 w-4 text-main-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelledAppointments}</div>
            <p className="text-xs text-muted-foreground">
              نوبت‌های لغو شده
            </p>
          </CardContent>
        </Card>
      </div>

      {/* My Hairdresser */}
      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle>آرایشگر من</CardTitle>
          <CardDescription>آرایشگر ترجیحی شما در سالن</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center text-white font-bold">
                {(profile?.preferredEmployee?.name || 'تیم سالن').slice(0,1)}
              </div>
              <div>
                <div className="font-semibold text-foreground">
                  {profile?.preferredEmployee?.name || 'تیم سالن'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {profile?.preferredEmployee?.specialty || 'گروه متخصصین' }
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm">تغییر آرایشگر</Button>
          </div>
        </CardContent>
      </Card>

      {/* Next Appointment */}
      {stats.nextAppointment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-main-orange" />
              نوبت بعدی شما
            </CardTitle>
            <CardDescription>
              جزئیات نوبت بعدی شما
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">تاریخ:</span>
                  <span>{formatDate(stats.nextAppointment.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">خدمت:</span>
                  <span>{stats.nextAppointment.service}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">کارمند:</span>
                  <span>{stats.nextAppointment.employee}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">وضعیت:</span>
                  <Badge 
                    variant={stats.nextAppointment.status === 'CONFIRMED' ? 'default' : 'secondary'}
                    className={stats.nextAppointment.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : ''}
                  >
                    {stats.nextAppointment.status === 'CONFIRMED' ? 'تایید شده' : 'در انتظار'}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  ویرایش
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                  لغو نوبت
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
              onClick={() => router.push('/dashboard/customer/book-appointment')}
            >
              <UserPlus className="h-6 w-6" />
              <span>رزرو نوبت</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/customer/appointments')}
            >
              <Calendar className="h-6 w-6" />
              <span>نوبت‌های من</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/customer/history')}
            >
              <History className="h-6 w-6" />
              <span>تاریخچه</span>
            </Button>
            <Button 
              variant="outline" 
              className="h-20 flex flex-col gap-2"
              onClick={() => router.push('/dashboard/customer/settings')}
            >
              <Star className="h-6 w-6" />
              <span>تنظیمات</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}