"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Users, 
  DollarSign, 
  TrendingUp,
  UserCog,
  Scissors,
  Settings,
  BarChart3,
  Clock,
  CheckCircle,
  ArrowUpRight,
  Sparkles,
  Activity,
  UserPlus,
  CalendarPlus,
  DollarSign as DollarSignIcon,
  Users as UsersIcon,
  UserCog as UserCogIcon,
  Scissors as ScissorsIcon,
  DollarSign as AccountingIcon,
  Users as UsersManagementIcon,
  Shield as ShieldIcon,
  Settings as SettingsIcon,
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { formatCompactMoney } from '@/lib/money'

interface AdminStats {
  totalAppointments: number
  todayAppointments: number
  totalCustomers: number
  totalEmployees: number
  monthlyRevenue: number
  pendingAppointments: number
  completedAppointments: number
}

export default function AdminDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [stats, setStats] = useState<AdminStats>({
    totalAppointments: 0,
    todayAppointments: 0,
    totalCustomers: 0,
    totalEmployees: 0,
    monthlyRevenue: 0,
    pendingAppointments: 0,
    completedAppointments: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      if (currentUser.role !== 'ADMIN') {
        router.push(`/dashboard/${currentUser.role.toLowerCase()}`)
        return
      }
    }
    fetchAdminData()
  }, [])

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/dashboard/admin-stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch admin stats')
      }

      const data = await response.json()
      setStats({
        totalAppointments: data.totalAppointments || 0,
        todayAppointments: data.todayAppointments || 0,
        totalCustomers: data.totalCustomers || 0,
        totalEmployees: data.totalEmployees || 0,
        monthlyRevenue: data.monthlyRevenue || 0,
        pendingAppointments: data.pendingAppointments || 0,
        completedAppointments: data.completedAppointments || 0
      })
    } catch (error) {
      console.error('Error fetching admin data:', error)
      // Fallback to zero values if API fails
      setStats({
        totalAppointments: 0,
        todayAppointments: 0,
        totalCustomers: 0,
        totalEmployees: 0,
        monthlyRevenue: 0,
        pendingAppointments: 0,
        completedAppointments: 0
      })
    } finally {
      setLoading(false)
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
    <div className="flex-1 space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold tracking-tight text-foreground">
              خوش آمدید، {user?.name}
            </h1>
          </div>
          <p className="text-muted-foreground">
            پنل مدیریت سیستم - نمای کلی عملکرد سالن
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="primary" 
            onClick={() => router.push('/dashboard/appointments')}
            className="shadow-lg hover:shadow-xl group"
          >
            <Calendar className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
            مدیریت نوبت‌ها
            <ArrowUpRight className="h-4 w-4 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </Button>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card  className="group hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">کل نوبت‌ها</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalAppointments}</div>
            <div className="flex items-center mt-2">
              <Badge variant="success" className="text-xs">
                {stats.todayAppointments} امروز
              </Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card  className="group hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">درآمد امسال</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatCompactMoney(stats.monthlyRevenue)}
            </div>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-3 w-3 text-success mr-1" />
              <span className="text-xs text-success font-medium">سود خالص</span>
            </div>
          </CardContent>
        </Card>
        
        <Card  className="group hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">کل مشتریان</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-info/10 flex items-center justify-center group-hover:bg-info/20 transition-colors">
              <Users className="h-5 w-5 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalCustomers}</div>
            <p className="text-xs text-muted-foreground mt-2">مشتریان فعال</p>
          </CardContent>
        </Card>
        
        <Card  className="group hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">کارکنان</CardTitle>
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center group-hover:bg-warning/20 transition-colors">
              <UserCog className="h-5 w-5 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{stats.totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-2">کارکنان فعال</p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card  className="group hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">در انتظار تأیید</CardTitle>
            <Clock className="h-5 w-5 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.pendingAppointments}</div>
            <p className="text-xs text-muted-foreground mt-1">نیاز به تأیید</p>
          </CardContent>
        </Card>
        
        <Card  className="group hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">تکمیل شده</CardTitle>
            <CheckCircle className="h-5 w-5 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.completedAppointments}</div>
            <p className="text-xs text-muted-foreground mt-1">این ماه</p>
          </CardContent>
        </Card>
        
        <Card  className="group hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">نرخ تکمیل</CardTitle>
            <BarChart3 className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalAppointments > 0 ? ((stats.completedAppointments / stats.totalAppointments) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">نوبت‌های موفق</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card  className="hover:shadow-xl transition-all duration-300">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">عملیات سریع</CardTitle>
          </div>
          <CardDescription>
            دسترسی سریع به بخش‌های مدیریتی سیستم
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              className="h-24 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push('/dashboard/appointments')}
            >
              <Calendar className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="font-medium">نوبت‌ها</span>
            </Button>
            <Button 
              className="h-24 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push('/dashboard/customers')}
            >
              <UsersIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="font-medium">مشتریان</span>
            </Button>
            <Button 
              className="h-24 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push('/dashboard/staff')}
            >
              <UserCogIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="font-medium">کارکنان</span>
            </Button>
            <Button 
              className="h-24 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push('/dashboard/services')}
            >
              <ScissorsIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="font-medium">خدمات</span>
            </Button>
            <Button 
              className="h-24 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push('/dashboard/accounting')}
            >
              <AccountingIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="font-medium">حسابداری</span>
            </Button>
            <Button 
              className="h-24 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push('/dashboard/admin/users')}
            >
              <UsersManagementIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="font-medium">کاربران</span>
            </Button>
            <Button 
              className="h-24 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push('/dashboard/admin/permissions')}
            >
              <ShieldIcon className="h-6 w-6 group-hover:scale-110 transition-transform" />
              <span className="font-medium">دسترسی‌ها</span>
            </Button>
            <Button 
              className="h-24 flex flex-col gap-3 hover:shadow-lg transition-all duration-200 group"
              onClick={() => router.push('/dashboard/settings')}
            >
              <SettingsIcon className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
              <span className="font-medium">تنظیمات</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}