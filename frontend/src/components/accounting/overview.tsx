'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import api from '../../lib/axios';
import { toThousandTomans } from '@/lib/money';

interface ChartData {
  month: string;
  income: number;
  expense: number;
  year: number;
  monthIndex: number;
}

interface BarberAppointmentData {
  name: string;
  count: number;
}

export function Overview() {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [barberAppointments, setBarberAppointments] = useState<BarberAppointmentData[]>([]);
  const [stats, setStats] = useState({
    totalIncome: 0,
    totalExpense: 0,
    totalBalance: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // دریافت داده‌های نمودار ماهانه
        const chartResponse = await api.get('/accounting/monthly-chart?months=12');
        console.log('📊 Chart data:', chartResponse.data);
        
        if (chartResponse.data && chartResponse.data.length > 0) {
          setChartData(chartResponse.data);
          
          // محاسبه آمار کلی
          const totalIncome = chartResponse.data.reduce((sum: number, item: ChartData) => sum + item.income, 0);
          const totalExpense = chartResponse.data.reduce((sum: number, item: ChartData) => sum + item.expense, 0);
          const totalBalance = totalIncome - totalExpense;
          
          setStats({
            totalIncome,
            totalExpense,
            totalBalance
          });
        }

        // دریافت داده‌های تعداد نوبت آرایشگرها
        const dashboardResponse = await api.get('/dashboard/summary');
        console.log('📊 Dashboard data:', dashboardResponse.data);
        
        if (dashboardResponse.data && dashboardResponse.data.appointmentsByBarber) {
          // مرتب‌سازی بر اساس تعداد نوبت (بیشترین به کمترین)
          const sortedBarberAppointments = dashboardResponse.data.appointmentsByBarber
            .sort((a: BarberAppointmentData, b: BarberAppointmentData) => b.count - a.count);
          setBarberAppointments(sortedBarberAppointments);
        }
      } catch (error) {
        console.error('❌ Error fetching chart data:', error);
        setChartData([]);
        setBarberAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xl backdrop-blur-sm">
          <div className="border-b border-gray-100 pb-2 mb-2">
            <p className="font-bold text-gray-900 text-lg">{label}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-gray-600 font-medium">درآمد:</span>
              </div>
              <span className="text-green-700 font-bold">
                {toThousandTomans(payload[0]?.value || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-600 font-medium">هزینه:</span>
              </div>
              <span className="text-red-700 font-bold">
                {toThousandTomans(payload[1]?.value || 0)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">سود خالص:</span>
                <span className={`font-bold ${
                  (payload[0]?.value || 0) - (payload[1]?.value || 0) >= 0 
                    ? 'text-green-700' 
                    : 'text-red-700'
                }`}>
                  {toThousandTomans((payload[0]?.value || 0) - (payload[1]?.value || 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const BarberTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-xl shadow-xl backdrop-blur-sm">
          <div className="border-b border-gray-100 pb-2 mb-2">
            <p className="font-bold text-gray-900 text-lg">{label}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600 font-medium">تعداد نوبت:</span>
              </div>
              <span className="text-blue-700 font-bold">
                {payload[0]?.value || 0} نوبت
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-96 bg-gray-200 rounded animate-pulse" />
        <div className="h-96 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* کارت‌های خلاصه */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="p-2 bg-green-500 rounded-lg">
                <ArrowTrendingUpIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-600">کل درآمد</p>
                <p className="text-2xl font-bold text-green-700">
                  {toThousandTomans(stats.totalIncome)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="p-2 bg-red-500 rounded-lg">
                <ArrowTrendingDownIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-600">کل هزینه</p>
                <p className="text-2xl font-bold text-red-700">
                  {toThousandTomans(stats.totalExpense)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 space-x-reverse">
              <div className="p-2 bg-blue-500 rounded-lg">
                <CurrencyDollarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-600">موجودی کل</p>
                <p className={`text-2xl font-bold ${stats.totalBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                  {stats.totalBalance >= 0 ? '' : '-'}{toThousandTomans(Math.abs(stats.totalBalance))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* نمودار 12 ماه */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">
            نمودار درآمد و هزینه - سال شمسی {new Date().getFullYear()}
          </CardTitle>
          <p className="text-sm text-gray-600">
            نمایش داده‌ها بر اساس ماه‌های شمسی از فروردین تا اسفند
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={chartData} 
                barCategoryGap={24} 
                barGap={12} 
                style={{ fontFamily: 'Vazirmatn, Tahoma, Arial' }}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" stopOpacity={0.5} />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={13}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickMargin={8}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                  tickMargin={8}
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={40}
                  wrapperStyle={{ 
                    paddingBottom: '15px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar
                  dataKey="income"
                  fill="url(#incomeGradient)"
                  radius={[6, 6, 0, 0]}
                  name="درآمد"
                />
                <Bar
                  dataKey="expense"
                  fill="url(#expenseGradient)"
                  radius={[6, 6, 0, 0]}
                  name="هزینه"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 w-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-4">📊</div>
                <p className="text-lg font-medium">هیچ داده‌ای برای نمایش وجود ندارد</p>
                <p className="text-sm">در حال حاضر تراکنشی در سیستم ثبت نشده است</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نمودار تعداد نوبت آرایشگرها */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-800">
            آمار نوبت‌های آرایشگران - کل
          </CardTitle>
          <p className="text-sm text-gray-600">
            نمایش تعداد کل نوبت‌های هر آرایشگر از بیشترین به کمترین
          </p>
        </CardHeader>
        <CardContent>
          {barberAppointments.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={barberAppointments} 
                barCategoryGap={24} 
                barGap={12} 
                style={{ fontFamily: 'Vazirmatn, Tahoma, Arial' }}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="appointmentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={1}/>
                  </linearGradient>
                </defs>
                
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={13}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickMargin={8}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickMargin={8}
                />
                <Tooltip 
                  content={<BarberTooltip />}
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                />
                <Legend 
                  verticalAlign="top" 
                  height={40}
                  wrapperStyle={{ 
                    paddingBottom: '15px',
                    fontSize: '13px',
                    fontWeight: '500'
                  }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar
                  dataKey="count"
                  fill="url(#appointmentGradient)"
                  radius={[6, 6, 0, 0]}
                  name="تعداد نوبت"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 w-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <div className="text-4xl mb-4">👨‍💼</div>
                <p className="text-lg font-medium">هیچ داده‌ای برای نمایش وجود ندارد</p>
                <p className="text-sm">در حال حاضر نوبتی برای آرایشگران ثبت نشده است</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 