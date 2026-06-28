'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PersianDatePicker from '@/components/ui/PersianDatePicker';
import { useToast } from '@/components/ui/use-toast';
import { Calculator, CreditCard, DollarSign, CalendarDays } from 'lucide-react';
import axios from '@/lib/axios';
import { formatCompactMoney } from '@/lib/money';
import { getCurrentJalaliDate } from '@/lib/date';

interface PreviewAppointment {
  id: number;
  scheduledAt: string;
  scheduledAtJalali: string;
  status: string;
  amountRial: string;
  customerName: string;
}

interface PreviewResult {
  periodFromJalali: string;
  periodToJalali: string;
  totalAppointments: number;
  totalRevenue: string;
  employeeShare: string;
  platformShare: string;
  commissionPercentageUsed: number;
  excludedAlreadySettledAppointments: number;
  appointments: PreviewAppointment[];
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'انجام شده',
  PAID: 'پرداخت شده',
  SETTLED: 'تسویه شده',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export default function EmployeeSalaryRequestPage() {
  const { toast } = useToast();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handlePreview = useCallback(async () => {
    if (!fromDate || !toDate) {
      toast({
        title: 'خطا',
        description: 'تاریخ شروع و پایان را انتخاب کنید',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      setPreview(null);
      setHasSearched(true);
      const res = await axios.get<PreviewResult>('/employees/me/salary-request/preview', {
        params: { from: fromDate, to: toDate },
      });
      setPreview(res.data);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message ?? 'خطا در دریافت پیش‌نمایش';
      const description = Array.isArray(msg) ? msg.join('، ') : String(msg);
      toast({ title: 'خطا', description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, toast]);

  const setCurrentMonthRange = () => {
    const today = getCurrentJalaliDate('YYYY/MM/DD');
    const [jy, jm] = today.split('/');
    setFromDate(`${jy}/${jm}/01`);
    setToDate(today);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">درخواست حقوق</h1>
        <p className="text-muted-foreground mt-1">
          پیش‌نمایش درآمد نوبت‌ها و سهم شما و سالن در بازه زمانی انتخابی
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            انتخاب بازه زمانی
          </CardTitle>
          <CardDescription>
            فقط تاریخ (بدون ساعت). حداکثر ۹۰ روز. انعام در محاسبه لحاظ نمی‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>از تاریخ</Label>
              <PersianDatePicker
                value={fromDate}
                onChange={setFromDate}
                placeholder="۱۴۰۳/۰۱/۰۱"
                className="mt-1"
              />
            </div>
            <div>
              <Label>تا تاریخ</Label>
              <PersianDatePicker
                value={toDate}
                onChange={setToDate}
                placeholder="۱۴۰۳/۰۱/۳۱"
                className="mt-1"
                minDate={fromDate || undefined}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handlePreview}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Calculator className="w-4 h-4 ml-2" />
              {loading ? 'در حال محاسبه...' : 'پیش‌نمایش'}
            </Button>
            <Button type="button" variant="outline" onClick={setCurrentMonthRange} disabled={loading}>
              ماه جاری
            </Button>
          </div>
        </CardContent>
      </Card>

      {preview && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">تعداد نوبت‌ها</p>
                <p className="text-2xl font-bold">{preview.totalAppointments}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">مجموع درآمد (ریال)</p>
                <p className="text-2xl font-bold">
                  {formatCompactMoney(Number(preview.totalRevenue))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  سهم شما ({preview.commissionPercentageUsed}٪)
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCompactMoney(Number(preview.employeeShare))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">سهم سالن</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCompactMoney(Number(preview.platformShare))}
                </p>
              </CardContent>
            </Card>
          </div>

          {preview.excludedAlreadySettledAppointments > 0 && (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {preview.excludedAlreadySettledAppointments} نوبت قبلاً در تسویه ادمین لحاظ شده و در
              این پیش‌نمایش نیست.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                نوبت‌های بازه {preview.periodFromJalali} تا {preview.periodToJalali}
              </CardTitle>
              <CardDescription>
                فقط نوبت‌های تکمیل‌شده/تسویه‌شده با مبلغ ثبت‌شده (بدون انعام)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {preview.appointments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>نوبت واجد شرایطی در این بازه یافت نشد</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">تاریخ</TableHead>
                        <TableHead className="text-right">مشتری</TableHead>
                        <TableHead className="text-right">وضعیت</TableHead>
                        <TableHead className="text-right">مبلغ (ریال)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.appointments.map((apt) => (
                        <TableRow key={apt.id}>
                          <TableCell className="font-medium">{apt.scheduledAtJalali}</TableCell>
                          <TableCell>{apt.customerName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{statusLabel(apt.status)}</Badge>
                          </TableCell>
                          <TableCell>{formatCompactMoney(Number(apt.amountRial))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!preview && hasSearched && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>نتیجه‌ای برای نمایش وجود ندارد</p>
          </CardContent>
        </Card>
      )}

      {!hasSearched && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CreditCard className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>بازه زمانی را انتخاب کنید و دکمه پیش‌نمایش را بزنید</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
