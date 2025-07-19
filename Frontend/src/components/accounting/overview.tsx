'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Overview as OverviewChart } from './overview-chart';
import { RecentTransactions } from './recent-transactions';
import { formatNumber } from '../../lib/utils';
import api from '../../lib/axios';
import { useRouter } from 'next/navigation';

interface OverviewStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  monthlyIncome: number;
  monthlyExpense: number;
  serviceIncome?: number;
  tipIncome?: number;
}

export function Overview() {
  const [stats, setStats] = useState<OverviewStats>({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    monthlyIncome: 0,
    monthlyExpense: 0,
    serviceIncome: 0,
    tipIncome: 0,
  });
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/accounting/stats');
        let serviceIncome = 0;
        let tipIncome = 0;
        // اگر API فعلی این مقادیر را ندارد، جداگانه بگیر
        const entriesRes = await api.get('/accounting/entries?page=1&limit=100&type=INCOME');
        if (entriesRes.data && Array.isArray(entriesRes.data.items)) {
          for (const entry of entriesRes.data.items) {
            if (entry.category?.name === 'درآمد خدمات') serviceIncome += entry.amount;
            if (entry.category?.name === 'تیپ') tipIncome += entry.amount;
          }
        }
        setStats({ ...response.data, serviceIncome, tipIncome });
      } catch (error) {
        setStats({
          totalIncome: 0,
          totalExpense: 0,
          balance: 0,
          monthlyIncome: 0,
          monthlyExpense: 0,
          serviceIncome: 0,
          tipIncome: 0,
        });
        alert('خطا در دریافت اطلاعات حسابداری!');
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">درآمد کل</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.totalIncome)} تومان</div>
          <p className="text-xs text-muted-foreground">
            +20.1% نسبت به ماه قبل
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">هزینه کل</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.totalExpense)} تومان</div>
          <p className="text-xs text-muted-foreground">
            +10.5% نسبت به ماه قبل
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">موجودی</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.balance)} تومان</div>
          <p className="text-xs text-muted-foreground">
            +12.5% نسبت به ماه قبل
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">درآمد این ماه</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.monthlyIncome)} تومان</div>
          <p className="text-xs text-muted-foreground">
            +8.2% نسبت به ماه قبل
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">درآمد خدمات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.serviceIncome)} تومان</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">درآمد تیپ</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.tipIncome)} تومان</div>
        </CardContent>
      </Card>
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>نمودار درآمد و هزینه</CardTitle>
        </CardHeader>
        <CardContent className="pl-2">
          <OverviewChart onMonthClick={(jm) => router.push(`/dashboard/accounting/${jm}`)} />
        </CardContent>
      </Card>
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>تراکنش‌های اخیر</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentTransactions />
        </CardContent>
      </Card>
    </div>
  );
} 