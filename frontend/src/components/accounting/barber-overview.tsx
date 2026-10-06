'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatTomansFromRial } from '@/lib/money';
import api from '../../lib/axios';
import { getCurrentJalaliDate } from '@/lib/date';
import { CurrencyDollarIcon, ChartBarIcon, UserIcon, BanknotesIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/use-toast';
import { Badge } from '@/components/ui/badge';

interface BarberStats {
  totalIncome: number;
  totalTips: number;
  totalWithdrawn: number;
  totalSalaries: number;
  currentBalance: number;
  salaryPercentage?: number;
  availableIncome?: number; // درآمد قابل برداشت (قبل از کسر برداشت‌ها)
  salonShare?: number; // سهم آرایشگاه
  todayTips?: number;
  recentTipTransactions?: Array<{
    id: number;
    amount: number;
    date: string;
    description: string;
  }>;
  tipBreakdown?: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
}

interface SalesChartData {
  month: string;
  sales: number;
  tips: number;
  total: number;
}

export function BarberOverview() {
  const [stats, setStats] = useState<BarberStats>({
    totalIncome: 0,
    totalTips: 0,
    totalWithdrawn: 0,
    totalSalaries: 0,
    currentBalance: 0,
  });
  const [salesChart, setSalesChart] = useState<SalesChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  const loadStaffFinance = async () => {
    // Root cause: /accounting/barbers/me/balance, /barber-sales-chart, and /barbers/me
    // were never ported after payroll moved to Employee + Transaction. Do not restore
    // those dead handlers — staff finance now lives on /employees/me/*.
    const today = getCurrentJalaliDate('YYYY/MM/DD');
    const [jy, jm] = today.split('/');
    const from = `${jy}/${jm}/01`;
    const [summaryRes, withdrawalsRes] = await Promise.all([
      api.get('/employees/me/salary-summary', { params: { from, to: today } }),
      api.get('/employees/me/withdrawals', { params: { page: 1, limit: 20 } }),
    ]);
    const preview = summaryRes.data?.preview;
    setStats({
      totalIncome: Number(preview?.totalRevenue ?? 0),
      totalTips: Number(preview?.totalTipIncome ?? 0),
      totalWithdrawn: Number(withdrawalsRes.data?.totalAmountRial ?? 0),
      totalSalaries: 0,
      currentBalance: Number(preview?.netPayable ?? 0),
      availableIncome: Number(preview?.withdrawable ?? preview?.netPayable ?? 0),
    });
    setSalesChart([]);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        await loadStaffFinance();
      } catch (error) {
        console.error('Error fetching barber accounting data:', error);
        toast({
          title: "خطا در دریافت اطلاعات",
          description: "لطفا دوباره تلاش کنید",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const handleWithdrawalRequest = () => {
    router.push('/dashboard/employee/salary-request');
  };

  const refreshData = async () => {
    try {
      setLoading(true);
      await loadStaffFinance();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">...</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Balance Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">موجودی کل</CardTitle>
            <BanknotesIcon className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatTomansFromRial(stats.currentBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              شامل درآمد خدمات و تیپ‌ها
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">درآمد خدمات</CardTitle>
            <CurrencyDollarIcon className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatTomansFromRial(stats.totalIncome)}
            </div>
            <p className="text-xs text-muted-foreground">
              از خدمات ارائه شده
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تیپ‌های دریافتی</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {formatTomansFromRial(stats.totalTips)}
            </div>
            <p className="text-xs text-muted-foreground">
              تیپ‌های روزانه و مشتریان
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">برداشت‌های انجام شده</CardTitle>
            <ChartBarIcon className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {formatTomansFromRial(stats.totalWithdrawn)}
            </div>
            <p className="text-xs text-muted-foreground">
              از موجودی حساب
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" />
            عملیات سریع
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-accent border border-border backdrop-blur-md rounded-lg">
            <div>
              <h3 className="font-medium text-foreground">درخواست برداشت</h3>
              <p className="text-sm text-foreground">
                موجودی قابل برداشت: {formatTomansFromRial(stats.availableIncome || 0)}
              </p>
            </div>
            <Button 
              onClick={handleWithdrawalRequest}
              variant="glass"
              className="text-foreground"
            >
              <BanknotesIcon className="h-4 w-4 ml-2" />
              درخواست برداشت
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-accent border border-border backdrop-blur-md rounded-lg">
            <div>
              <h3 className="font-medium text-foreground">بروزرسانی اطلاعات</h3>
              <p className="text-sm text-foreground">
                آخرین بروزرسانی: {new Date().toLocaleTimeString('fa-IR')}
              </p>
            </div>
            <Button 
              onClick={refreshData}
              variant="glass"
              className="text-foreground"
            >
              <ArrowUpIcon className="h-4 w-4 ml-2" />
              بروزرسانی
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tips Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpIcon className="h-5 w-5 text-foreground" />
            اطلاعات تیپ‌ها
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
              <span className="font-medium">تیپ‌های دریافتی:</span>
              <Badge variant="secondary" className="bg-accent text-foreground">
                {formatTomansFromRial(stats.totalTips)}
              </Badge>
            </div>
            {stats.todayTips && stats.todayTips > 0 && (
              <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                <span className="font-medium">تیپ‌های امروز:</span>
                <Badge variant="secondary" className="bg-accent text-foreground">
                  {formatTomansFromRial(stats.todayTips)}
                </Badge>
              </div>
            )}
            <div className="text-sm text-foreground bg-accent border border-border backdrop-blur-md p-3 rounded-lg">
              💡 <strong className="text-foreground">نکته:</strong> تیپ‌های روزانه به صورت خودکار به موجودی شما اضافه می‌شوند و می‌توانید از طریق درخواست برداشت، آن‌ها را دریافت کنید.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Tip Transactions */}
      {stats.recentTipTransactions && stats.recentTipTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpIcon className="h-5 w-5 text-foreground" />
              آخرین تراکنش‌های تیپ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentTipTransactions.slice(0, 5).map((tip) => (
                <div key={tip.id} className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tip.description}</p>
                    <p className="text-xs text-foreground">
                      {new Date(tip.date).toLocaleDateString('fa-IR')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-accent text-foreground">
                    +{formatTomansFromRial(tip.amount)}
                  </Badge>
                </div>
              ))}
              {stats.recentTipTransactions.length > 5 && (
                <div className="text-center text-sm text-foreground">
                  و {stats.recentTipTransactions.length - 5} تراکنش دیگر...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales Chart */}
      {salesChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChartBarIcon className="h-5 w-5" />
              نمودار فروش و تیپ (6 ماه اخیر)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {salesChart.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-accent border border-border backdrop-blur-md rounded-lg">
                  <span className="font-medium text-foreground">{item.month}</span>
                  <div className="flex gap-4">
                    <span className="text-foreground">فروش: {formatTomansFromRial(item.sales)}</span>
                    <span className="text-foreground">تیپ: {formatTomansFromRial(item.tips)}</span>
                    <span className="text-foreground font-bold">کل: {formatTomansFromRial(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 