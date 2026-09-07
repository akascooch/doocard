'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Calculator, CreditCard, DollarSign, CalendarDays, Bell } from 'lucide-react';
import axios from '@/lib/axios';
import { formatTomansFromRial } from '@/lib/money';
import { formatToJalali, getTehranCurrentJalaliMonthRange } from '@/lib/date';
import usePushNotifications from '@/hooks/usePushNotifications';
import { getCurrentUser } from '@/lib/auth';
import {
  SalaryBreakdown,
  SalaryBreakdownPanel,
} from '@/components/salary/SalaryBreakdownPanel';
import {
  ServiceTipLine,
  ServiceTipLinesTable,
} from '@/components/salary/ServiceTipLinesTable';

interface PreviewResult {
  periodFromJalali: string;
  periodToJalali: string;
  totalAppointments: number;
  totalRevenue: string;
  employeeShare: string;
  platformShare: string;
  totalDeduction: string;
  deductionPerAppointmentAmount: string;
  priorWithdrawalsTotal: string;
  netPayable: string;
  settlementPayable?: string;
  commissionPercentageUsed: number;
  excludedAlreadySettledAppointments: number;
  isServiceStaff?: boolean;
  totalTipIncome?: string;
  teamShareIncome?: string;
  tipAllocationCount?: number;
  breakdown?: SalaryBreakdown;
  tipLines?: ServiceTipLine[];
  appointments: Array<{
    id: number;
    scheduledAtJalali: string;
    status: string;
    amountRial: string;
    customerName: string;
  }>;
}

interface SalaryRequestRow {
  id: number;
  requestType: string;
  status: string;
  upToJalali: string;
  periodStartJalali?: string | null;
  requestedAmountRial: string;
  availableAtRequestRial: string;
  createdAt: string;
  breakdown?: SalaryBreakdown | null;
  tipLines?: ServiceTipLine[] | null;
  tipLinesAvailable?: boolean;
  snapshotJson?: { tipLines?: ServiceTipLine[] } | null;
}

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'انجام شده',
  PAID: 'پرداخت شده',
  SETTLED: 'تسویه شده',
  PENDING: 'در انتظار',
  APPROVED: 'تأیید شده',
  REJECTED: 'رد شده',
  CANCELLED: 'لغو شده',
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  PAYROLL_WITHDRAWAL: 'برداشت حقوق',
  ADVANCE: 'مساعده',
  COMMISSION_SETTLEMENT: 'تسویه کمیسیون',
};

const CHEQUE_PAYROLL_SOURCE = 'CHEQUE_LEAF_PAYROLL';

interface WithdrawalRow {
  id: number;
  occurredAt: string;
  amountRial: string;
  description: string | null;
  categoryName: string | null;
  sourceType: string | null;
}

export default function EmployeeSalaryRequestPage() {
  const { toast } = useToast();
  const user = getCurrentUser();
  const { isSubscribed, isSupported, subscribe, isLoading: pushLoading } = usePushNotifications();
  const [fromDate, setFromDate] = useState(() => getTehranCurrentJalaliMonthRange().from);
  const [toDate, setToDate] = useState(() => getTehranCurrentJalaliMonthRange().to);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [requests, setRequests] = useState<SalaryRequestRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [withdrawalsTotalRial, setWithdrawalsTotalRial] = useState('0');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [requestType, setRequestType] = useState('PAYROLL_WITHDRAWAL');
  const [amount, setAmount] = useState('');
  const [destinationNote, setDestinationNote] = useState('');
  const [allowNegative, setAllowNegative] = useState(false);
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const res = await axios.get('/employees/me/salary-requests');
      setRequests(res.data || []);
    } catch {
      setRequests([]);
    }
  }, []);

  const loadWithdrawals = useCallback(async (from = fromDate, to = toDate) => {
    try {
      const res = await axios.get('/employees/me/withdrawals', {
        params: { page: 1, limit: 50, from, to },
      });
      setWithdrawals(res.data?.data || []);
      setWithdrawalsTotalRial(res.data?.totalAmountRial || '0');
    } catch {
      setWithdrawals([]);
      setWithdrawalsTotalRial('0');
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    void loadWithdrawals(fromDate, toDate);
    // Initial current-month history only; later refetches are preview / ماه جاری / submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setAmount(res.data.netPayable || '0');
      await loadWithdrawals(fromDate, toDate);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message ?? 'خطا در دریافت پیش‌نمایش';
      const description = Array.isArray(msg) ? msg.join('، ') : String(msg);
      toast({ title: 'خطا', description, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, toast, loadWithdrawals]);

  const handleSubmitRequest = async () => {
    if (!preview || !toDate) return;
    try {
      setSubmitting(true);
      await axios.post('/employees/me/salary-requests', {
        requestType,
        upToJalali: toDate,
        periodStartJalali: fromDate,
        requestedAmountRial: amount.replace(/,/g, ''),
        destinationNote: destinationNote || undefined,
        allowNegative: requestType === 'ADVANCE' ? allowNegative : false,
      });
      toast({ title: 'موفق', description: 'درخواست با اسنپ‌شات ثبت شد' });
      await loadRequests();
      await loadWithdrawals();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
          ?.message ?? 'خطا در ثبت درخواست';
      toast({
        title: 'خطا',
        description: Array.isArray(msg) ? msg.join('، ') : String(msg),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const setCurrentMonthRange = () => {
    const { from, to } = getTehranCurrentJalaliMonthRange();
    setFromDate(from);
    setToDate(to);
    void loadWithdrawals(from, to);
  };

  const liveBreakdown: SalaryBreakdown | null =
    preview?.breakdown ??
    (preview
      ? {
          isServiceStaff: preview.isServiceStaff,
          grossAmount: preview.isServiceStaff
            ? preview.totalTipIncome || preview.employeeShare
            : preview.totalRevenue,
          shopShareAmount: preview.isServiceStaff ? '0' : preview.platformShare,
          employeeShareAmount: preview.isServiceStaff
            ? preview.totalTipIncome || preview.employeeShare
            : preview.employeeShare,
          tipAmount: preview.isServiceStaff ? preview.totalTipIncome || '0' : '0',
          teamTipAmount: preview.teamShareIncome || '0',
          deductionAmount: preview.isServiceStaff ? '0' : preview.totalDeduction,
          paidAmount: preview.priorWithdrawalsTotal,
          finalAmount: preview.netPayable,
          appointmentCount: preview.totalAppointments,
          tipAllocationCount: preview.tipAllocationCount,
          commissionPercentageUsed: preview.commissionPercentageUsed,
        }
      : null);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">درخواست حقوق</h1>
        <p className="text-muted-foreground mt-1">
          پیش‌نمایش موجودی با جزئیات محاسبه، ثبت درخواست، و مشاهده تاریخچه برداشت‌ها (مبالغ به تومان)
        </p>
      </div>

      {(user?.role === 'SERVICE' || user?.role === 'EMPLOYEE') &&
        isSupported &&
        !isSubscribed && (
          <Card className="border-main-orange/40 bg-orange-50/50 dark:bg-orange-950/20">
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center gap-3">
              <Bell className="h-5 w-5 text-main-orange shrink-0" />
              <p className="text-sm flex-1">
                برای دریافت آنی اعلان انعام و یادآور حساب، اعلان‌های مرورگر را فعال کنید. پیامک ارسال
                نمی‌شود.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => void subscribe()}
                disabled={pushLoading}
              >
                {pushLoading ? 'در حال فعال‌سازی...' : 'فعال‌سازی اعلان'}
              </Button>
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5" />
            انتخاب بازه زمانی
          </CardTitle>
          <CardDescription>حداکثر ۹۰ روز. تا تاریخ = سقف محاسبه</CardDescription>
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

      {preview && liveBreakdown && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  {preview.isServiceStaff ? 'تعداد انعام' : 'تعداد نوبت‌ها'}
                </p>
                <p className="text-2xl font-bold">
                  {preview.isServiceStaff
                    ? preview.tipAllocationCount ?? 0
                    : preview.totalAppointments}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  {preview.isServiceStaff
                    ? 'انعام'
                    : `سهم شما (${preview.commissionPercentageUsed}٪)`}
                </p>
                <p className="text-xl font-bold text-green-600 tabular-nums">
                  {formatTomansFromRial(
                    preview.isServiceStaff
                      ? preview.totalTipIncome ?? 0
                      : preview.employeeShare,
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  {preview.isServiceStaff ? 'پرداخت‌شده قبلی' : 'کسورات نوبت'}
                </p>
                <p className="text-xl font-bold text-amber-600 tabular-nums">
                  {formatTomansFromRial(
                    preview.isServiceStaff
                      ? preview.priorWithdrawalsTotal
                      : preview.totalDeduction,
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  {preview.isServiceStaff
                    ? 'قابل برداشت'
                    : 'قابل برداشت از سهم نوبت‌ها'}
                </p>
                <p className="text-xl font-bold text-green-700 tabular-nums">
                  {formatTomansFromRial(preview.netPayable)}
                </p>
              </CardContent>
            </Card>
          </div>

          <SalaryBreakdownPanel breakdown={liveBreakdown} defaultOpen />

          {preview.isServiceStaff && (
            <ServiceTipLinesTable
              tipLines={preview.tipLines ?? []}
              tipLinesKnownMissing={false}
            />
          )}

          {preview.excludedAlreadySettledAppointments > 0 && (
            <p className="text-sm text-amber-700">
              {preview.excludedAlreadySettledAppointments} نوبت قبلاً تسویه شده و در این
              پیش‌نمایش نیست.
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle>ثبت درخواست</CardTitle>
              <CardDescription>
                {preview.isServiceStaff
                  ? 'مبلغ در لحظه ثبت به‌صورت اسنپ‌شات ذخیره می‌شود. نمایش به تومان است؛ ارسال به ریال.'
                  : 'سقف و پیش‌فرض درخواست = قابل برداشت از سهم نوبت‌ها. نمایش به تومان؛ ارسال به ریال.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>نوع درخواست</Label>
                  <Select value={requestType} onValueChange={setRequestType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAYROLL_WITHDRAWAL">برداشت حقوق</SelectItem>
                      <SelectItem value="ADVANCE">مساعده</SelectItem>
                      <SelectItem value="COMMISSION_SETTLEMENT">تسویه کمیسیون</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>مبلغ درخواستی (ریال — منبع)</Label>
                  <Input
                    className="mt-1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                  />
                  <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                    معادل نمایشی: {formatTomansFromRial(amount || '0')}
                  </p>
                </div>
              </div>
              <div>
                <Label>حساب مقصد (اختیاری — متن)</Label>
                <Input
                  className="mt-1"
                  value={destinationNote}
                  onChange={(e) => setDestinationNote(e.target.value)}
                  placeholder="شماره کارت / شبا"
                />
              </div>
              {requestType === 'ADVANCE' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={allowNegative}
                    onChange={(e) => setAllowNegative(e.target.checked)}
                  />
                  اجازه موجودی منفی (مساعده بیش از موجودی)
                </label>
              )}
              <Button
                onClick={handleSubmitRequest}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <DollarSign className="w-4 h-4 ml-2" />
                {submitting ? 'در حال ثبت...' : 'ثبت درخواست'}
              </Button>
            </CardContent>
          </Card>

          {!preview.isServiceStaff && preview.appointments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  نوبت‌های بازه
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">تاریخ</TableHead>
                      <TableHead className="text-right">مشتری</TableHead>
                      <TableHead className="text-right">وضعیت</TableHead>
                      <TableHead className="text-right">مبلغ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.appointments.map((apt) => (
                      <TableRow key={apt.id}>
                        <TableCell>{apt.scheduledAtJalali}</TableCell>
                        <TableCell>{apt.customerName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {STATUS_LABELS[apt.status] ?? apt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatTomansFromRial(apt.amountRial)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>تاریخچه برداشت‌ها</CardTitle>
          <CardDescription>
            برداشت‌های ثبت‌شده توسط مدیریت از حقوق شما، شامل واریز حقوق با چک. جمع:{' '}
            <span className="tabular-nums">{formatTomansFromRial(withdrawalsTotalRial)}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">برداشتی ثبت نشده است</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">تاریخ</TableHead>
                  <TableHead className="text-right">شرح</TableHead>
                  <TableHead className="text-right">منبع</TableHead>
                  <TableHead className="text-right">مبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{formatToJalali(w.occurredAt)}</TableCell>
                    <TableCell>
                      {w.description || w.categoryName || 'برداشت'}
                    </TableCell>
                    <TableCell>
                      {w.sourceType === CHEQUE_PAYROLL_SOURCE ? (
                        <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">
                          واریز حقوق / مساعده
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {w.categoryName || w.sourceType || 'برداشت'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatTomansFromRial(w.amountRial)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تاریخچه درخواست‌ها</CardTitle>
          <CardDescription>برای هر درخواست می‌توانید جزئیات محاسبه اسنپ‌شات را ببینید</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">درخواستی ثبت نشده</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const expanded = expandedRequestId === r.id;
                return (
                  <div key={r.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {REQUEST_TYPE_LABELS[r.requestType] ?? r.requestType}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          تا {r.upToJalali}
                          {r.periodStartJalali ? ` · از ${r.periodStartJalali}` : ''}
                        </div>
                      </div>
                      <div className="text-left space-y-1">
                        <div className="font-semibold tabular-nums text-green-700">
                          {formatTomansFromRial(r.requestedAmountRial)}
                        </div>
                        <Badge variant="secondary">{STATUS_LABELS[r.status] ?? r.status}</Badge>
                      </div>
                    </div>
                    {r.breakdown && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setExpandedRequestId(expanded ? null : r.id)
                          }
                        >
                          {expanded ? 'بستن جزئیات' : 'جزئیات محاسبه'}
                        </Button>
                        {expanded && (
                          <div className="space-y-3">
                            <SalaryBreakdownPanel
                              breakdown={r.breakdown}
                              defaultOpen
                              showZeroRows={false}
                            />
                            {r.breakdown.isServiceStaff && (
                              <ServiceTipLinesTable
                                tipLines={
                                  r.tipLines ??
                                  r.snapshotJson?.tipLines ??
                                  null
                                }
                                tipLinesKnownMissing={
                                  r.tipLines == null &&
                                  r.snapshotJson?.tipLines == null
                                }
                              />
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {!preview && hasSearched && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>نتیجه‌ای برای نمایش وجود ندارد</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
