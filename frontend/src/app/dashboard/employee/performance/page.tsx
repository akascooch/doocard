'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BarChart3, Calendar, Scissors, Users, Wallet } from 'lucide-react';
import { api } from '@/lib/axios';
import { formatTomansFromRial } from '@/lib/money';
import { getCurrentUser } from '@/lib/auth';
import { canAccessEmployeeDashboard, getDashboardHomePath } from '@/lib/user-roles';
import { useRouter } from 'next/navigation';

type YearRow = {
  year: number;
  completedCount: number;
  cancelledCount: number;
  uniqueCustomers: number;
  netEarningsRial: string;
};

type MonthRow = {
  month: number;
  monthName: string;
  completedCount: number;
  uniqueCustomers: number;
  netEarningsRial: string;
};

type TopService = {
  name: string;
  count: number;
  grossRial: string;
};

type PerformanceDto = {
  currentJalaliYear: number;
  selectedJalaliYear: number;
  summary: {
    completedCount: number;
    cancelledCount: number;
    uniqueCustomers: number;
    netEarningsRial: string;
  };
  years: YearRow[];
  months: MonthRow[];
  topServices: TopService[];
};

export default function EmployeePerformancePage() {
  const router = useRouter();
  const [data, setData] = useState<PerformanceDto | null>(null);
  const [year, setYear] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (selected?: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/dashboard/employee-performance', {
        params: selected ? { year: selected } : undefined,
      });
      const payload = response.data as PerformanceDto;
      setData(payload);
      setYear(String(payload.selectedJalaliYear));
    } catch (err) {
      console.error(err);
      setError('بارگذاری گزارش عملکرد با خطا مواجه شد');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const user = getCurrentUser();
    if (user && !canAccessEmployeeDashboard(user.role)) {
      router.replace(getDashboardHomePath(user.role));
      return;
    }
    load();
  }, [load, router]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 p-1 sm:p-0">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">گزارش عملکرد</h1>
          <p className="text-muted-foreground text-sm mt-1">
            آمار نوبت‌ها و سهم خالص تسویه در پنج سال جلالی اخیر
          </p>
        </div>
        {data && (
          <div className="w-full sm:w-44">
            <label className="text-xs text-muted-foreground mb-1 block">سال ماهانه</label>
            <Select
              value={year}
              onValueChange={(value) => {
                setYear(value);
                load(value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="انتخاب سال" />
              </SelectTrigger>
              <SelectContent>
                {data.years.map((row) => (
                  <SelectItem key={row.year} value={String(row.year)}>
                    {row.year.toLocaleString('fa-IR')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={Calendar}
          title="نوبت انجام‌شده"
          value={(summary?.completedCount ?? 0).toLocaleString('fa-IR')}
        />
        <SummaryCard
          icon={Calendar}
          title="لغو شده"
          value={(summary?.cancelledCount ?? 0).toLocaleString('fa-IR')}
        />
        <SummaryCard
          icon={Users}
          title="مشتری یکتا"
          value={(summary?.uniqueCustomers ?? 0).toLocaleString('fa-IR')}
        />
        <SummaryCard
          icon={Wallet}
          title="سهم خالص ۵ سال"
          value={formatTomansFromRial(summary?.netEarningsRial)}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            گزارش سالانه
          </CardTitle>
          <CardDescription>تعداد نوبت، مشتری یکتا و سهم خالص هر سال</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground border-b">
                <th className="py-2 font-medium">سال</th>
                <th className="py-2 font-medium">انجام‌شده</th>
                <th className="py-2 font-medium">لغو</th>
                <th className="py-2 font-medium">مشتری یکتا</th>
                <th className="py-2 font-medium">سهم خالص</th>
              </tr>
            </thead>
            <tbody>
              {(data?.years ?? []).map((row) => (
                <tr key={row.year} className="border-b last:border-0">
                  <td className="py-2">{row.year.toLocaleString('fa-IR')}</td>
                  <td className="py-2">{row.completedCount.toLocaleString('fa-IR')}</td>
                  <td className="py-2">{row.cancelledCount.toLocaleString('fa-IR')}</td>
                  <td className="py-2">{row.uniqueCustomers.toLocaleString('fa-IR')}</td>
                  <td className="py-2">{formatTomansFromRial(row.netEarningsRial)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">گزارش ماهانه {year}</CardTitle>
          <CardDescription>۱۲ ماه سال انتخاب‌شده</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-muted-foreground border-b">
                <th className="py-2 font-medium">ماه</th>
                <th className="py-2 font-medium">نوبت</th>
                <th className="py-2 font-medium">مشتری یکتا</th>
                <th className="py-2 font-medium">سهم خالص</th>
              </tr>
            </thead>
            <tbody>
              {(data?.months ?? []).map((row) => (
                <tr key={row.month} className="border-b last:border-0">
                  <td className="py-2">{row.monthName}</td>
                  <td className="py-2">{row.completedCount.toLocaleString('fa-IR')}</td>
                  <td className="py-2">{row.uniqueCustomers.toLocaleString('fa-IR')}</td>
                  <td className="py-2">{formatTomansFromRial(row.netEarningsRial)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scissors className="h-5 w-5" />
            خدمات برتر سال {year}
          </CardTitle>
          <CardDescription>بر اساس تعداد نوبت انجام‌شده — مبلغ، قیمت خدمت در زمان رزرو است</CardDescription>
        </CardHeader>
        <CardContent>
          {(data?.topServices ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">خدمتی برای این سال ثبت نشده</p>
          ) : (
            <ul className="space-y-3">
              {data!.topServices.map((service) => (
                <li
                  key={service.name}
                  className="flex items-center justify-between gap-3 border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {service.count.toLocaleString('fa-IR')} نوبت
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatTomansFromRial(service.grossRial)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  value,
}: {
  icon: typeof Calendar;
  title: string;
  value: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-lg sm:text-2xl font-bold leading-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
