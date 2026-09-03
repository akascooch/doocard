'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, DollarSign, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../lib/axios';
import { PersianDatePicker } from '../../components/ui/persian-date-picker';
import { formatTomansFromRial } from '@/lib/money';

interface DailyTipStats {
  date: string;
  totalAmount: number;
  staffShareTotal: number;
  salonShareTotal: number;
  transactionCount: number;
  isDivided: boolean;
  transactions: TipTransaction[];
}

interface TipTransaction {
  id: number;
  amount: number;
  staffShare: number | null;
  salonShare: number | null;
  tipRecipientType: string | null;
  tipShares?: Array<{
    employeeId: number;
    employeeName: string;
    amount: number;
  }>;
  createdAt: string;
  customerName: string;
  barberName: string;
  tipRecipientName: string;
  appointmentId: number;
  description: string;
}

export function DailyTips() {
  const [stats, setStats] = useState<DailyTipStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  function dateToGregorianString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  useEffect(() => {
    fetchDailyStats();
  }, [selectedDate]);

  const fetchDailyStats = async () => {
    setLoading(true);
    try {
      const gregorianDate = dateToGregorianString(selectedDate);
      const response = await api.get(`/appointments/tip-daily-stats?date=${gregorianDate}`);
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      toast.error('خطا در دریافت آمار روزانه انعام');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">انعام روزانه</h2>
          <p className="text-muted-foreground">
            انعام‌های تسویه‌شده با تخصیص فردی/تیمی (از تسویه نوبت)
          </p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مجموع انعام</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTomansFromRial(stats?.totalAmount || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">سهم پرسنل</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTomansFromRial(stats?.staffShareTotal || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">سهم سالن</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatTomansFromRial(stats?.salonShareTotal || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">وضعیت تخصیص</CardTitle>
            {stats?.isDivided ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.isDivided ? 'تخصیص‌شده' : 'قدیمی / بدون تخصیص'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.transactionCount || 0} تراکنش
            </p>
          </CardContent>
        </Card>
      </div>

      <Button variant="outline" onClick={fetchDailyStats} className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        بروزرسانی
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            تراکنش‌های انعام
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.transactions && stats.transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>سهم پرسنل</TableHead>
                    <TableHead>سهم سالن</TableHead>
                    <TableHead>گیرنده</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>آرایشگر</TableHead>
                    <TableHead>ساعت</TableHead>
                    <TableHead>توضیحات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-medium">
                        {formatTomansFromRial(transaction.amount)}
                      </TableCell>
                      <TableCell>
                        {transaction.staffShare != null
                          ? formatTomansFromRial(transaction.staffShare)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        {transaction.salonShare != null
                          ? formatTomansFromRial(transaction.salonShare)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div>{transaction.tipRecipientName}</div>
                          {transaction.tipShares && transaction.tipShares.length > 0 && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {transaction.tipShares.map((s) => (
                                <div key={s.employeeId}>
                                  {s.employeeName}: {formatTomansFromRial(s.amount)}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{transaction.customerName}</TableCell>
                      <TableCell>{transaction.barberName}</TableCell>
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
              <p className="text-muted-foreground">هیچ انعامی برای این روز یافت نشد</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
