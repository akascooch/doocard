'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, Users, DollarSign, TrendingUp, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/axios';
import { PersianDatePicker } from '../../components/ui/persian-date-picker';
import * as jalaali from 'jalaali-js';

interface DailyTipStats {
  date: string;
  totalAmount: number;
  transactionCount: number;
  isDivided: boolean;
  transactions: TipTransaction[];
}

interface TipTransaction {
  id: number;
  amount: number;
  createdAt: string;
  customerName: string;
  barberName: string;
  appointmentId: number;
  description: string;
}

interface Barber {
  id: number;
  firstName: string;
  lastName: string;
}

interface TipDivisionResult {
  totalAmount: number;
  dividedAmount: number;
  remainder: number;
  barberCount: number;
  date: string;
  results: {
    barberId: number;
    barberName: string;
    amount: number;
    entryId: number;
  }[];
}

export function DailyTips() {
  const [stats, setStats] = useState<DailyTipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarberIds, setSelectedBarberIds] = useState<number[]>([]);
  const [divideAmount, setDivideAmount] = useState('');
  const [dividing, setDividing] = useState(false);
  const [showDivideModal, setShowDivideModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [divisionResult, setDivisionResult] = useState<TipDivisionResult | null>(null);

  function dateToGregorianString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    fetchDailyStats();
    fetchBarbers();
  }, [selectedDate]);

  const fetchDailyStats = async () => {
    setLoading(true);
    try {
      const gregorianDate = dateToGregorianString(selectedDate);
      const response = await api.get(`/accounting/tips/daily-stats?date=${gregorianDate}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      toast.error('خطا در دریافت آمار روزانه');
    } finally {
      setLoading(false);
    }
  };

  const fetchBarbers = async () => {
    try {
      const response = await api.get('/barbers');
      setBarbers(response.data);
    } catch (error) {
      console.error('Error fetching barbers:', error);
      toast.error('خطا در دریافت لیست کارمندان');
    }
  };

  const handleDivideTips = async () => {
    if (!divideAmount || isNaN(Number(divideAmount)) || Number(divideAmount) <= 0) {
      toast.error('مبلغ معتبر وارد کنید');
      return;
    }
    if (selectedBarberIds.length === 0) {
      toast.error('حداقل یک کارمند را انتخاب کنید');
      return;
    }
    if (Number(divideAmount) > (stats?.totalAmount || 0)) {
      toast.error('مبلغ تقسیم نمی‌تواند بیشتر از مجموع تیپ روزانه باشد');
      return;
    }

    setDividing(true);
    try {
      const gregorianDate = dateToGregorianString(selectedDate);
      const response = await api.post('/accounting/tips/divide', {
        amount: Number(divideAmount),
        barberIds: selectedBarberIds,
        date: gregorianDate,
      });
      
      setDivisionResult(response.data);
      toast.success('تیپ با موفقیت تقسیم شد');
      setShowDivideModal(false);
      setDivideAmount('');
      setSelectedBarberIds([]);
      fetchDailyStats(); // بروزرسانی آمار
    } catch (error: any) {
      console.error('Error dividing tips:', error);
      toast.error(error.response?.data?.message || 'خطا در تقسیم تیپ');
    } finally {
      setDividing(false);
    }
  };

  const handleCancelDivision = async () => {
    if (!stats || !stats.isDivided) {
      toast.error('تیپ این روز تقسیم نشده است که لغو شود.');
      return;
    }

    if (confirm('آیا از لغو تقسیم تیپ برای این روز مطمئن هستید؟ این عمل باعث حذف رکوردهای حقوقی پرداخت نشده مربوط به این تقسیم می‌شود.')) {
      try {
        const gregorianDate = dateToGregorianString(selectedDate);
        await api.post('/accounting/tips/cancel-division', { date: gregorianDate });
        toast.success('تقسیم تیپ با موفقیت لغو شد.');
        fetchDailyStats(); // بروزرسانی آمار
      } catch (error: any) {
        console.error('Error cancelling division:', error);
        toast.error(error.response?.data?.message || 'خطا در لغو تقسیم');
      }
    }
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fa-IR');
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fa-IR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">تیپ روزانه</h2>
          <p className="text-muted-foreground">مدیریت و تقسیم تیپ‌های روزانه</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <PersianDatePicker
            value={selectedDate}
            onChange={(date) => date && setSelectedDate(date)}
            className="w-40"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مجموع تیپ</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(stats?.totalAmount || 0)}</div>
            <p className="text-xs text-muted-foreground">تومان</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تعداد تراکنش</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.transactionCount || 0}</div>
            <p className="text-xs text-muted-foreground">تراکنش</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">وضعیت تقسیم</CardTitle>
            {stats?.isDivided ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.isDivided ? 'تقسیم شده' : 'تقسیم نشده'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.isDivided ? 'تیپ این روز تقسیم شده' : 'در انتظار تقسیم'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تاریخ</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.date || 'نامشخص'}</div>
            <p className="text-xs text-muted-foreground">تاریخ شمسی</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Dialog open={showDivideModal} onOpenChange={setShowDivideModal}>
          <DialogTrigger asChild>
            <Button 
              disabled={stats?.isDivided || (stats?.totalAmount || 0) === 0}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              تقسیم تیپ بین کارمندان
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>تقسیم تیپ روزانه</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="amount">مبلغ تقسیم (تومان)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={divideAmount}
                  onChange={(e) => setDivideAmount(e.target.value)}
                  placeholder={`حداکثر ${formatAmount(stats?.totalAmount || 0)} تومان`}
                  max={stats?.totalAmount || 0}
                />
                <p className="text-sm text-muted-foreground mt-1">
                  مجموع تیپ روزانه: {formatAmount(stats?.totalAmount || 0)} تومان
                </p>
              </div>

              <div>
                <Label>انتخاب کارمندان</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-y-auto">
                  {barbers.map((barber) => (
                    <div key={barber.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`barber-${barber.id}`}
                        checked={selectedBarberIds.includes(barber.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBarberIds([...selectedBarberIds, barber.id]);
                          } else {
                            setSelectedBarberIds(selectedBarberIds.filter(id => id !== barber.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor={`barber-${barber.id}`} className="text-sm">
                        {barber.firstName} {barber.lastName}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {selectedBarberIds.length > 0 && divideAmount && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium mb-2">پیش‌نمایش تقسیم:</p>
                  <p className="text-sm">
                    هر کارمند: {formatAmount(Math.floor(Number(divideAmount) / selectedBarberIds.length))} تومان
                  </p>
                  <p className="text-sm text-muted-foreground">
                    باقیمانده: {Number(divideAmount) % selectedBarberIds.length} تومان
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDivideModal(false)}>
                  انصراف
                </Button>
                <Button 
                  onClick={handleDivideTips}
                  disabled={dividing || !divideAmount || selectedBarberIds.length === 0}
                >
                  {dividing ? 'در حال تقسیم...' : 'تقسیم تیپ'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Button 
          variant="outline" 
          onClick={fetchDailyStats}
          className="flex items-center gap-2"
        >
          <TrendingUp className="h-4 w-4" />
          بروزرسانی
        </Button>

        {stats?.isDivided && (
          <Button 
            variant="outline"
            onClick={handleCancelDivision}
            className="flex items-center gap-2 text-red-500 border-red-500 hover:bg-red-50"
          >
            <XCircle className="h-4 w-4" />
            لغو تقسیم
          </Button>
        )}
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            تراکنش‌های تیپ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.transactions && stats.transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>آرایشگر</TableHead>
                    <TableHead>تاریخ</TableHead>
                    <TableHead>ساعت</TableHead>
                    <TableHead>توضیحات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {formatAmount(transaction.amount)} تومان
                      </TableCell>
                      <TableCell>{transaction.customerName}</TableCell>
                      <TableCell>{transaction.barberName}</TableCell>
                      <TableCell>{formatDate(transaction.createdAt)}</TableCell>
                      <TableCell>{formatTime(transaction.createdAt)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {transaction.description}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">هیچ تراکنش تیپی برای این روز یافت نشد</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Division Result Modal */}
      {divisionResult && (
        <Dialog open={!!divisionResult} onOpenChange={() => setDivisionResult(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                تیپ با موفقیت تقسیم شد
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium">مجموع مبلغ</p>
                  <p className="text-lg font-bold">{formatAmount(divisionResult.totalAmount)} تومان</p>
                </div>
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium">تعداد کارمندان</p>
                  <p className="text-lg font-bold">{divisionResult.barberCount} نفر</p>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">جزئیات تقسیم:</h4>
                <div className="space-y-2">
                  {divisionResult.results.map((result) => (
                    <div key={result.barberId} className="flex justify-between items-center p-2 bg-muted rounded">
                      <span>{result.barberName}</span>
                      <Badge variant="secondary">{formatAmount(result.amount)} تومان</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {divisionResult.remainder > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    باقیمانده: {formatAmount(divisionResult.remainder)} تومان
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setDivisionResult(null)}>
                  بستن
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
} 