"use client"

import { useEffect, useState } from 'react'
import api from '../../lib/axios'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { UsersIcon, CalendarIcon, ScissorsIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useRouter } from 'next/navigation'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({
    revenue: 0,
    appointments: [],
    popularServices: [],
    summary: {
      totalCustomers: 0,
      totalAppointments: 0,
      totalRevenue: 0,
      completionRate: 0,
    },
    appointmentsByDay: [],
  })
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // چک لاگین بودن کاربر
    const checkAuth = async () => {
      try {
        await api.get('/users/me');
        setAuthChecked(true);
      } catch (error) {
        router.replace('/login');
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    const fetchData = async () => {
      try {
        const [
          revenueRes,
          appointmentsRes,
          popularServicesRes,
          summaryRes,
          appointmentsByDayRes,
        ] = await Promise.all([
          api.get('/dashboard/revenue'),
          api.get('/appointments'),
          api.get('/dashboard/popular-services'),
          api.get('/dashboard/summary'),
          api.get('/dashboard/appointments-by-day'),
        ])

        setData({
          revenue: revenueRes.data,
          appointments: appointmentsRes.data,
          popularServices: popularServicesRes.data?.services || [],
          summary: summaryRes.data,
          appointmentsByDay: appointmentsByDayRes.data?.appointments || [],
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData();
  }, [authChecked]);

  if (!authChecked) {
    return null;
  }

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('fa-IR').format(price) + ' تومان'

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  <Skeleton className="h-4 w-[150px]" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[100px]" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-[200px]" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-4 w-[200px]" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* کارت‌های آماری */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تعداد مشتریان</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary?.totalCustomers?.toLocaleString('fa-IR') || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              مشتری فعال
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تعداد نوبت‌ها</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary?.totalAppointments?.toLocaleString('fa-IR') || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              نوبت ثبت شده
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">درآمد کل</CardTitle>
            <ChartBarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(data.summary?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              از ابتدا تاکنون
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نرخ تکمیل</CardTitle>
            <ScissorsIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.summary?.completionRate?.toLocaleString('fa-IR') || '0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              نوبت‌های انجام شده
            </p>
          </CardContent>
        </Card>
      </div>

      {/* نمودارها */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* نمودار نوبت‌ها بر اساس روز */}
        <Card>
          <CardHeader>
            <CardTitle>نوبت‌ها بر اساس روز</CardTitle>
            <CardDescription>
              تعداد نوبت‌های ثبت شده در هر روز هفته
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={Array.isArray(data.appointmentsByDay) ? data.appointmentsByDay : []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* نمودار محبوب‌ترین خدمات */}
        <Card>
          <CardHeader>
            <CardTitle>محبوب‌ترین خدمات</CardTitle>
            <CardDescription>
              پرطرفدارترین خدمات بر اساس تعداد نوبت
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={Array.isArray(data.popularServices) ? data.popularServices : []}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {(Array.isArray(data.popularServices) ? data.popularServices : []).map((entry: any, index: number) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 