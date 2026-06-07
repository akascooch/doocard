'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatNumber } from '../../lib/utils';
import api from '../../lib/axios';
import { getCurrentUser } from '../../lib/auth';
import { CurrencyDollarIcon, ChartBarIcon, UserIcon, CalendarIcon, BanknotesIcon, ArrowUpIcon } from '@heroicons/react/24/outline';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalDescription, setWithdrawalDescription] = useState('');
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalDialogOpen, setWithdrawalDialogOpen] = useState(false);
  const { toast } = useToast();
  const user = getCurrentUser();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [balanceRes, salesChartRes] = await Promise.all([
          api.get('/accounting/barbers/me/balance'),
          api.get('/accounting/barber-sales-chart?months=6'),
        ]);
        
        console.log('📊 Barber balance received:', balanceRes.data);
        
        // تبدیل داده‌های جدید به فرمت قدیمی برای سازگاری
        const balanceData = balanceRes.data;
        setStats({
          totalIncome: balanceData.totalServiceIncome,
          totalTips: balanceData.totalTips,
          totalWithdrawn: balanceData.totalWithdrawals,
          totalSalaries: 0, // این فیلد دیگر استفاده نمی‌شود
          currentBalance: balanceData.currentBalance,
          availableIncome: balanceData.availableForWithdrawal,
          salaryPercentage: 60, // پیش‌فرض
          todayTips: balanceData.todayTips,
          recentTipTransactions: balanceData.recentTipTransactions,
          tipBreakdown: balanceData.tipBreakdown,
        });
        
        setSalesChart(salesChartRes.data || []);
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

  const handleWithdrawalRequest = async () => {
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      toast({
        title: "خطا",
        description: "لطفا مبلغ معتبر وارد کنید",
        variant: "destructive",
      });
      return;
    }

    // حذف محدودیت مبلغ - آرایشگر می‌تواند هر مقداری درخواست کند
    if (stats.availableIncome && parseFloat(withdrawalAmount) > stats.availableIncome) {
      toast({
        title: "هشدار",
        description: "مبلغ درخواستی بیشتر از درآمد قابل برداشت شماست. ممکن است درخواست شما رد شود.",
        variant: "destructive",
      });
      // ادامه می‌دهیم - اجازه می‌دهیم درخواست ارسال شود
    }

    try {
      setWithdrawalLoading(true);
      console.log('🔍 Getting barber info...');
      const barber = await api.get('/barbers/me');
      console.log('🔍 Barber info received:', barber.data);
      
      if (!barber.data || !barber.data.id) {
        throw new Error('اطلاعات آرایشگر یافت نشد');
      }
      
      console.log('🔍 Sending withdrawal request...');
      console.log('🔍 Request details:', {
        url: `/accounting/barbers/${barber.data.id}/withdrawals`,
        data: {
          amount: parseFloat(withdrawalAmount),
          description: withdrawalDescription || 'درخواست برداشت حقوق',
        }
      });
      
      const response = await api.post(`/accounting/barbers/${barber.data.id}/withdrawals`, {
        amount: parseFloat(withdrawalAmount),
        description: withdrawalDescription || 'درخواست برداشت حقوق',
      });
      console.log('✅ Withdrawal response:', response.data);

      toast({
        title: "درخواست ارسال شد",
        description: "درخواست برداشت شما با موفقیت ثبت شد",
      });

      setWithdrawalDialogOpen(false);
      setWithdrawalAmount('');
      setWithdrawalDescription('');
      
      // Refresh stats
      const statsRes = await api.get('/accounting/stats');
      setStats(statsRes.data);
    } catch (error: any) {
      console.error('❌ Error requesting withdrawal:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
      
      const errorMessage = error.response?.data?.message || error.message || "خطا در ارسال درخواست برداشت";
      
      toast({
        title: "خطا",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const refreshData = async () => {
    try {
      setLoading(true);
      const [balanceRes, salesChartRes] = await Promise.all([
        api.get('/accounting/barbers/me/balance'),
        api.get('/accounting/barber-sales-chart?months=6'),
      ]);
      
      const balanceData = balanceRes.data;
      setStats({
        totalIncome: balanceData.totalServiceIncome,
        totalTips: balanceData.totalTips,
        totalWithdrawn: balanceData.totalWithdrawals,
        totalSalaries: 0,
        currentBalance: balanceData.currentBalance,
        availableIncome: balanceData.availableForWithdrawal,
        salaryPercentage: 60,
        todayTips: balanceData.todayTips,
        recentTipTransactions: balanceData.recentTipTransactions,
        tipBreakdown: balanceData.tipBreakdown,
      });
      
      setSalesChart(salesChartRes.data || []);
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
            <BanknotesIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatNumber(stats.currentBalance)} تومان
            </div>
            <p className="text-xs text-muted-foreground">
              شامل درآمد خدمات و تیپ‌ها
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">درآمد خدمات</CardTitle>
            <CurrencyDollarIcon className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatNumber(stats.totalIncome)} تومان
            </div>
            <p className="text-xs text-muted-foreground">
              از خدمات ارائه شده
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تیپ‌های دریافتی</CardTitle>
            <ArrowUpIcon className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatNumber(stats.totalTips)} تومان
            </div>
            <p className="text-xs text-muted-foreground">
              تیپ‌های روزانه و مشتریان
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">برداشت‌های انجام شده</CardTitle>
            <ChartBarIcon className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatNumber(stats.totalWithdrawn)} تومان
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
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h3 className="font-medium">درخواست برداشت</h3>
              <p className="text-sm text-gray-600">
                موجودی قابل برداشت: {formatNumber(stats.availableIncome || 0)} تومان
              </p>
            </div>
            <Button 
              onClick={() => setWithdrawalDialogOpen(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <BanknotesIcon className="h-4 w-4 ml-2" />
              درخواست برداشت
            </Button>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <h3 className="font-medium">بروزرسانی اطلاعات</h3>
              <p className="text-sm text-gray-600">
                آخرین بروزرسانی: {new Date().toLocaleTimeString('fa-IR')}
              </p>
            </div>
            <Button 
              onClick={refreshData}
              variant="outline"
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
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
            <ArrowUpIcon className="h-5 w-5 text-purple-600" />
            اطلاعات تیپ‌ها
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <span className="font-medium">تیپ‌های دریافتی:</span>
              <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                {formatNumber(stats.totalTips)} تومان
              </Badge>
            </div>
            {stats.todayTips && stats.todayTips > 0 && (
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <span className="font-medium">تیپ‌های امروز:</span>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {formatNumber(stats.todayTips)} تومان
                </Badge>
              </div>
            )}
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              💡 <strong>نکته:</strong> تیپ‌های روزانه به صورت خودکار به موجودی شما اضافه می‌شوند و می‌توانید از طریق درخواست برداشت، آن‌ها را دریافت کنید.
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Tip Transactions */}
      {stats.recentTipTransactions && stats.recentTipTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpIcon className="h-5 w-5 text-purple-600" />
              آخرین تراکنش‌های تیپ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentTipTransactions.slice(0, 5).map((tip) => (
                <div key={tip.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{tip.description}</p>
                    <p className="text-xs text-gray-600">
                      {new Date(tip.date).toLocaleDateString('fa-IR')}
                    </p>
                  </div>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    +{formatNumber(tip.amount)} تومان
                  </Badge>
                </div>
              ))}
              {stats.recentTipTransactions.length > 5 && (
                <div className="text-center text-sm text-gray-500">
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
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium">{item.month}</span>
                  <div className="flex gap-4">
                    <span className="text-blue-600">فروش: {formatNumber(item.sales)}</span>
                    <span className="text-purple-600">تیپ: {formatNumber(item.tips)}</span>
                    <span className="text-green-600 font-bold">کل: {formatNumber(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Withdrawal Dialog */}
      <Dialog open={withdrawalDialogOpen} onOpenChange={setWithdrawalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>درخواست برداشت از موجودی</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">مبلغ (تومان)</Label>
              <Input
                id="amount"
                type="number"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                placeholder="مبلغ مورد نظر را وارد کنید"
              />
            </div>
            <div>
              <Label htmlFor="description">توضیحات (اختیاری)</Label>
              <Input
                id="description"
                value={withdrawalDescription}
                onChange={(e) => setWithdrawalDescription(e.target.value)}
                placeholder="توضیحات درخواست"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              موجودی قابل برداشت: {formatNumber(stats.availableIncome ?? 0)} تومان
            </div>
            <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
              💡 شما می‌توانید هر مقداری درخواست کنید. درخواست‌های بیشتر از موجودی قابل برداشت نیاز به تایید ادمین دارند.
            </div>
            <Button 
              onClick={handleWithdrawalRequest} 
              disabled={withdrawalLoading || !withdrawalAmount}
              className="w-full"
            >
              {withdrawalLoading ? 'در حال ارسال...' : 'ثبت درخواست'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 