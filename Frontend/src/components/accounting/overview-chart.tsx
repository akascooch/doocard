'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import api from '../../lib/axios';
import jalaali from 'jalaali-js';

interface ChartData {
  name: string;
  income: number;
  expense: number;
}

export function Overview({ onMonthClick }: { onMonthClick?: (jm: number) => void }) {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await api.get('/accounting/chart');
        let chartData = response.data;
        // اگر داده‌ها ماه میلادی دارند، به شمسی تبدیل کن
        chartData = chartData.map((item: any) => {
          if (/^\d{4}-\d{2}/.test(item.name)) {
            const [gy, gm] = item.name.split('-').map(Number);
            const safeGm = Math.max(1, Math.min(12, gm));
            const { jm } = jalaali.toJalaali(gy, safeGm, 1);
            const persianMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
            return { ...item, name: persianMonths[jm-1], jm };
          }
          // اگر name فارسی است، jm را پیدا کن
          const persianMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
          const jm = persianMonths.indexOf(item.name) + 1;
          return { ...item, jm };
        });

        // ساخت آرایه کامل ۱۲ ماه از ماه فعلی
        const persianMonths = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
        // آرایه ماه‌ها را همیشه از فروردین بچرخان
        const orderedMonths = persianMonths;
        // داده‌ها را به ترتیب ماه‌های جدید مرتب کن و اگر داده‌ای نبود مقدار صفر قرار بده
        const fullData = orderedMonths.map((month, idx) => {
          const jm = idx + 1;
          const found = chartData.find((item: any) => item.jm === jm);
          return found || { name: month, income: 0, expense: 0, jm };
        });
        setData(fullData);
      } catch (error) {
        console.error('Error fetching chart data:', error);
        // Use sample data for now
        setData([
          {
            name: 'فروردین',
            income: 12000000,
            expense: 8000000,
          },
          {
            name: 'اردیبهشت',
            income: 15000000,
            expense: 9000000,
          },
          {
            name: 'خرداد',
            income: 18000000,
            expense: 10000000,
          },
          {
            name: 'تیر',
            income: 16000000,
            expense: 11000000,
          },
          {
            name: 'مرداد',
            income: 20000000,
            expense: 12000000,
          },
          {
            name: 'شهریور',
            income: 22000000,
            expense: 13000000,
          },
        ]);
      }
    };

    fetchData();
  }, []);

  // رنگ‌های حرفه‌ای و مدرن‌تر
  const COLORS = ['#4CAF50', '#FF7043', '#29B6F6', '#FFD600', '#AB47BC', '#66BB6A', '#FFA726', '#8D6E63', '#26A69A', '#EC407A', '#7E57C2', '#789262'];

  return (
    <ResponsiveContainer width="100%" height={370}>
      <BarChart data={data} barCategoryGap={28} barGap={8} style={{ fontFamily: 'Vazirmatn, Tahoma, Arial', cursor: onMonthClick ? 'pointer' : undefined }}>
        <XAxis
          dataKey="name"
          stroke="#666"
          fontSize={16}
          tickLine={false}
          axisLine={{ stroke: '#eee', strokeWidth: 2 }}
        />
        <YAxis
          stroke="#666"
          fontSize={15}
          tickLine={false}
          axisLine={{ stroke: '#eee', strokeWidth: 2 }}
          tickFormatter={(value) => value.toLocaleString('fa-IR')}
        />
        <Tooltip
          formatter={(value: number, name: string) => [`${value.toLocaleString('fa-IR')} تومان`, name === 'income' ? 'درآمد' : 'هزینه']}
          labelStyle={{ fontFamily: 'inherit', fontWeight: 'bold', direction: 'rtl', color: '#222' }}
          contentStyle={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 16px #0002', direction: 'rtl', fontSize: 15, fontFamily: 'inherit', border: '1px solid #eee' }}
          itemStyle={{ color: '#222', fontWeight: 500 }}
          cursor={{ fill: '#f5f5f5' }}
        />
        <Bar
          dataKey="income"
          fill="#4CAF50"
          radius={[12, 12, 0, 0]}
          name="درآمد"
          barSize={32}
          onClick={onMonthClick ? (data, index) => { if (typeof data.jm === 'number') onMonthClick(data.jm); } : undefined}
          style={{ transition: 'filter 0.2s', filter: 'brightness(1)' }}
          onMouseOver={e => { if (e && e.target) e.target.style.filter = 'brightness(1.15)'; }}
          onMouseOut={e => { if (e && e.target) e.target.style.filter = 'brightness(1)'; }}
        />
        <Bar
          dataKey="expense"
          fill="#FF7043"
          radius={[12, 12, 0, 0]}
          name="هزینه"
          barSize={32}
          onClick={onMonthClick ? (data, index) => { if (typeof data.jm === 'number') onMonthClick(data.jm); } : undefined}
          style={{ transition: 'filter 0.2s', filter: 'brightness(1)' }}
          onMouseOver={e => { if (e && e.target) e.target.style.filter = 'brightness(1.15)'; }}
          onMouseOut={e => { if (e && e.target) e.target.style.filter = 'brightness(1)'; }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
} 