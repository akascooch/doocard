'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import api from '../../lib/axios';

interface ChartData {
  month: string;
  income: number;
  expense: number;
  year: number;
  monthIndex: number;
}

export function MonthlyChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('📊 Fetching monthly chart data...');
        const response = await api.get('/accounting/monthly-chart?months=12');
        console.log('📊 Monthly chart response:', response.data);
        
        if (response.data && response.data.length > 0) {
          setData(response.data);
        } else {
          setData([]);
        }
      } catch (error) {
        console.error('❌ Error fetching monthly chart data:', error);
        setError('خطا در بارگذاری داده‌های نمودار');
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('fa-IR').format(value);
  };

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
                {formatNumber(payload[0]?.value || 0)} تومان
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-gray-600 font-medium">هزینه:</span>
              </div>
              <span className="text-red-700 font-bold">
                {formatNumber(payload[1]?.value || 0)} تومان
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
                  {formatNumber((payload[0]?.value || 0) - (payload[1]?.value || 0))} تومان
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">در حال بارگذاری نمودار ماهانه...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  // بررسی اینکه آیا داده‌ای وجود دارد
  const hasData = data.length > 0 && data.some(item => item.income > 0 || item.expense > 0);
  
  console.log('📊 Monthly chart data check:', {
    dataLength: data.length,
    hasData,
    sampleData: data.slice(0, 2)
  });

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="text-center">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600">هیچ داده‌ای برای نمایش وجود ندارد</p>
          <p className="text-sm text-gray-500 mt-2">
            در حال حاضر تراکنشی در سیستم ثبت نشده است
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart 
        data={data} 
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
        
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
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
  );
}
