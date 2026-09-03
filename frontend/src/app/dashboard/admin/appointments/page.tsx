'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Search, Plus, RefreshCcw, Clock, CheckCircle, AlertCircle, Filter, X } from 'lucide-react';
import { AppointmentForm, AppointmentList } from '@/components/appointments';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import PersianDatePicker from '@/components/ui/PersianDatePicker';
import {
  getTehranTodayJalali,
  getTehranAppointmentPresetRange,
  jalaliDayBoundsTehran,
  jalaliDateRangeBoundsTehran,
  persianToEnglishDigits,
} from '@/lib/date';
import { formatTomansFromRial } from '@/lib/money';
import { type EmployeeListItem, normalizeEmployeeList, getEmployeeDisplayName } from '@/lib/employee';
import { type AppointmentRecord } from '@/lib/appointment';

interface Appointment extends AppointmentRecord {}

type Employee = EmployeeListItem;
type PresetFilter = 'today' | 'tomorrow' | 'week' | 'month' | 'all';
type DateMode = 'quick' | 'single' | 'range';

type AppointmentsSummary = {
  totalCount: number;
  settledCount: number;
  settledSalesRial: string;
};

const tehranToday = () => getTehranTodayJalali();

const sortAppointments = (appointments: Appointment[]) => {
  const statusPriority: Record<string, number> = {
    PENDING_CONFIRMATION: 1,
    CONFIRMED: 2,
    PENDING: 2,
    SETTLED: 3,
    PAID: 3,
    COMPLETED: 3,
    CANCELLED: 4,
  };

  return [...appointments].sort((a, b) => {
    const aPriority = statusPriority[a.status] || 99;
    const bPriority = statusPriority[b.status] || 99;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  });
};

export default function AdminAppointmentsPage() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<PresetFilter>('today');

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateMode, setDateMode] = useState<DateMode>('quick');

  // Draft (UI) vs applied (query) — explicit apply avoids stale/eager reloads
  const [draftSingleDate, setDraftSingleDate] = useState(tehranToday);
  const [draftDateFrom, setDraftDateFrom] = useState(tehranToday);
  const [draftDateTo, setDraftDateTo] = useState(tehranToday);
  const [draftEmployeeId, setDraftEmployeeId] = useState<number | 'ALL'>('ALL');

  const [appliedSingleDate, setAppliedSingleDate] = useState(tehranToday);
  const [appliedDateFrom, setAppliedDateFrom] = useState(tehranToday);
  const [appliedDateTo, setAppliedDateTo] = useState(tehranToday);
  const [appliedEmployeeId, setAppliedEmployeeId] = useState<number | 'ALL'>('ALL');
  const [appliedDateMode, setAppliedDateMode] = useState<'single' | 'range'>('single');

  const [listMeta, setListMeta] = useState({ total: 0, take: 200 });
  const [summary, setSummary] = useState<AppointmentsSummary>({
    totalCount: 0,
    settledCount: 0,
    settledSalesRial: '0',
  });

  const buildDateParams = useCallback((): { from?: string; to?: string } | null => {
    if (!showAdvancedFilters || dateMode === 'quick') {
      return getTehranAppointmentPresetRange(dateFilter);
    }
    if (appliedDateMode === 'single') {
      const date = persianToEnglishDigits(appliedSingleDate).trim();
      return jalaliDayBoundsTehran(date);
    }
    const from = persianToEnglishDigits(appliedDateFrom).trim();
    const to = persianToEnglishDigits(appliedDateTo).trim();
    return jalaliDateRangeBoundsTehran(from, to);
  }, [
    showAdvancedFilters,
    dateMode,
    dateFilter,
    appliedDateMode,
    appliedSingleDate,
    appliedDateFrom,
    appliedDateTo,
  ]);

  const loadEmployees = useCallback(async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(normalizeEmployeeList(response.data));
    } catch (error) {
      console.error('❌ Error loading employees:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری لیست آرایشگران با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const loadAppointmentsAndSummary = useCallback(async () => {
    try {
      setLoading(true);
      setSummaryLoading(true);

      const dateRange = buildDateParams();
      if (dateRange === null) {
        toast({
          title: 'خطا',
          description: 'تاریخ انتخاب شده نامعتبر است',
          variant: 'destructive',
        });
        setLoading(false);
        setSummaryLoading(false);
        return;
      }

      const params: Record<string, string | number> = {};
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;

      if (showAdvancedFilters && appliedEmployeeId !== 'ALL') {
        params.employeeId = appliedEmployeeId;
      }
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const [listRes, summaryRes] = await Promise.all([
        api.get('/appointments', { params }),
        api.get('/appointments/summary', { params }),
      ]);

      const appointmentsData = listRes.data.data || listRes.data || [];
      const total = Number(listRes.data.total ?? appointmentsData.length) || 0;
      const take = Number(listRes.data.take ?? 200) || 200;
      setListMeta({ total, take });
      setAppointments(appointmentsData);

      setSummary({
        totalCount: Number(summaryRes.data?.totalCount ?? 0) || 0,
        settledCount: Number(summaryRes.data?.settledCount ?? 0) || 0,
        settledSalesRial: String(summaryRes.data?.settledSalesRial ?? '0'),
      });
    } catch (error) {
      console.error('Error loading appointments:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری نوبت‌ها با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setSummaryLoading(false);
    }
  }, [
    buildDateParams,
    showAdvancedFilters,
    appliedEmployeeId,
    searchTerm,
    statusFilter,
    toast,
  ]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Quick presets + applied advanced deps (not draft dates)
  useEffect(() => {
    loadAppointmentsAndSummary();
  }, [
    showAdvancedFilters,
    dateFilter,
    appliedDateMode,
    appliedSingleDate,
    appliedDateFrom,
    appliedDateTo,
    appliedEmployeeId,
    statusFilter,
    loadAppointmentsAndSummary,
  ]);

  const handlePresetClick = (preset: PresetFilter) => {
    setShowAdvancedFilters(false);
    setDateMode('quick');
    setDateFilter(preset);
  };

  const applyAdvancedFilters = () => {
    if (dateMode === 'single') {
      const date = persianToEnglishDigits(draftSingleDate).trim();
      const bounds = jalaliDayBoundsTehran(date);
      if (!bounds) {
        toast({ title: 'خطا', description: 'تاریخ انتخاب شده نامعتبر است', variant: 'destructive' });
        return;
      }
      setAppliedSingleDate(date);
      setDraftSingleDate(date);
      setAppliedDateMode('single');
    } else if (dateMode === 'range') {
      const from = persianToEnglishDigits(draftDateFrom).trim();
      const to = persianToEnglishDigits(draftDateTo).trim();
      const bounds = jalaliDateRangeBoundsTehran(from, to);
      if (!bounds) {
        toast({ title: 'خطا', description: 'تاریخ‌های انتخاب شده نامعتبر هستند', variant: 'destructive' });
        return;
      }
      if (new Date(bounds.from).getTime() > new Date(bounds.to).getTime()) {
        toast({
          title: 'خطا',
          description: 'تاریخ شروع نمی‌تواند بعد از تاریخ پایان باشد',
          variant: 'destructive',
        });
        return;
      }
      setAppliedDateFrom(from);
      setAppliedDateTo(to);
      setDraftDateFrom(from);
      setDraftDateTo(to);
      setAppliedDateMode('range');
    }
    setAppliedEmployeeId(draftEmployeeId);
    setShowAdvancedFilters(true);
    // load triggered by applied-* state change
  };

  const clearAdvancedFilters = () => {
    const today = tehranToday();
    setDateMode('quick');
    setDateFilter('today');
    setDraftSingleDate(today);
    setDraftDateFrom(today);
    setDraftDateTo(today);
    setDraftEmployeeId('ALL');
    setAppliedSingleDate(today);
    setAppliedDateFrom(today);
    setAppliedDateTo(today);
    setAppliedEmployeeId('ALL');
    setAppliedDateMode('single');
    setShowAdvancedFilters(false);
  };

  const handleFormSuccess = () => {
    loadAppointmentsAndSummary();
  };

  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = appointments;
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((apt) => apt.status === statusFilter);
    }
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (apt) =>
          apt.customerName?.toLowerCase().includes(searchLower) ||
          apt.employeeName?.toLowerCase().includes(searchLower),
      );
    }
    return sortAppointments(filtered);
  }, [appointments, statusFilter, searchTerm]);

  const stats = useMemo(
    () => ({
      total: filteredAndSortedAppointments.length,
      pending: filteredAndSortedAppointments.filter((a) => a.status === 'PENDING_CONFIRMATION').length,
      confirmed: filteredAndSortedAppointments.filter((a) => a.status === 'CONFIRMED').length,
      completed: filteredAndSortedAppointments.filter(
        (a) => a.status === 'SETTLED' || a.status === 'PAID',
      ).length,
    }),
    [filteredAndSortedAppointments],
  );

  const isPartialList = listMeta.total > appointments.length;

  const subtitle = useMemo(() => {
    if (showAdvancedFilters && dateMode !== 'quick') {
      if (appliedDateMode === 'single') {
        return `نوبت‌های ${appliedSingleDate}`;
      }
      return `نوبت‌های ${appliedDateFrom} تا ${appliedDateTo}`;
    }
    return (
      {
        today: 'نوبت‌های امروز',
        tomorrow: 'نوبت‌های فردا',
        week: 'نوبت‌های این هفته',
        month: 'نوبت‌های ماه جاری',
        all: 'همه نوبت‌ها',
      } as const
    )[dateFilter];
  }, [
    showAdvancedFilters,
    dateMode,
    appliedDateMode,
    appliedSingleDate,
    appliedDateFrom,
    appliedDateTo,
    dateFilter,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">مدیریت نوبت‌ها</h1>
        <p className="text-muted-foreground mt-1">
          {subtitle}
          {' - '}
          ثبت، مشاهده و تسویه نوبت‌های سالن
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {showAdvancedFilters ? 'فیلتر پیشرفته' : 'فیلتر سریع زمانی'}
            </CardTitle>
            <Button
              variant={showAdvancedFilters ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (showAdvancedFilters) {
                  setShowAdvancedFilters(false);
                  setDateMode('quick');
                  setDateFilter('today');
                } else {
                  const today = tehranToday();
                  setDraftSingleDate(appliedSingleDate || today);
                  setDraftDateFrom(appliedDateFrom || today);
                  setDraftDateTo(appliedDateTo || today);
                  setDraftEmployeeId(appliedEmployeeId);
                  setDateMode('single');
                  setShowAdvancedFilters(true);
                }
              }}
              className={cn(showAdvancedFilters && 'bg-primary text-primary-foreground hover:bg-primary/90')}
            >
              <Filter className="h-4 w-4 ml-2" />
              {showAdvancedFilters ? 'بازگشت به فیلتر سریع' : 'فیلتر پیشرفته'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!showAdvancedFilters ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['today', 'امروز', Clock],
                  ['tomorrow', 'فردا', Calendar],
                  ['week', 'این هفته', Calendar],
                  ['month', 'ماه جاری', Calendar],
                  ['all', 'همه نوبت‌ها', null],
                ] as const
              ).map(([key, label, Icon]) => (
                <Button
                  key={key}
                  variant={dateFilter === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetClick(key)}
                  className={cn(
                    'flex items-center gap-2',
                    dateFilter === key && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  {label}
                  {dateFilter === key && key === 'today' && stats.total > 0 && (
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{stats.total}</span>
                  )}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={dateMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateMode('single')}
                  className={cn(
                    dateMode === 'single' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  یک روز
                </Button>
                <Button
                  variant={dateMode === 'range' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateMode('range')}
                  className={cn(
                    dateMode === 'range' && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  )}
                >
                  بازه زمانی
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dateMode === 'single' && (
                  <PersianDatePicker
                    value={draftSingleDate}
                    onChange={setDraftSingleDate}
                    label="تاریخ"
                    placeholder="مثال: ۱۴۰۴/۰۴/۲۱"
                  />
                )}
                {dateMode === 'range' && (
                  <>
                    <PersianDatePicker
                      value={draftDateFrom}
                      onChange={setDraftDateFrom}
                      label="از تاریخ"
                      placeholder="تاریخ شروع"
                    />
                    <PersianDatePicker
                      value={draftDateTo}
                      onChange={setDraftDateTo}
                      label="تا تاریخ"
                      placeholder="تاریخ پایان"
                      minDate={draftDateFrom}
                    />
                  </>
                )}

                <div>
                  <Label>آرایشگر</Label>
                  <Select
                    value={draftEmployeeId.toString()}
                    onValueChange={(value) =>
                      setDraftEmployeeId(value === 'ALL' ? 'ALL' : Number(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">همه آرایشگرها</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id.toString()}>
                          {getEmployeeDisplayName(emp)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAdvancedFilters}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 ml-2" />
                  پاک کردن فیلترها
                </Button>
                <Button size="sm" onClick={applyAdvancedFilters}>
                  اعمال فیلتر
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              نوبت‌های تسویه شده (فیلتر فعلی)
            </CardDescription>
            <CardTitle className="text-4xl text-green-700 dark:text-green-300">
              {summaryLoading ? '…' : summary.settledCount}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              از {summary.totalCount} نوبت در فیلتر فعلی (کل جمعیت، نه فقط صفحه)
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-emerald-600 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              جمع فروش تسویه‌شده
            </CardDescription>
            <CardTitle className="text-3xl sm:text-4xl text-emerald-800 dark:text-emerald-300 tabular-nums">
              {summaryLoading ? '…' : formatTomansFromRial(summary.settledSalesRial)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              مجموع amount نوبت‌های SETTLED / PAID — محاسبه سمت سرور
            </p>
            {isPartialList && (
              <p className="text-xs text-amber-700 mt-2">
                توجه: جدول ناقص است ({appointments.length} از {listMeta.total}). جمع فروش از خلاصه سرور است و کامل است.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              کل نوبت‌ها
            </CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              نیاز به تأیید
            </CardDescription>
            <CardTitle className="text-3xl text-amber-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              تأیید شده
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">{stats.confirmed}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              تسویه شده
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.completed}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list">
            <Calendar className="h-4 w-4 ml-2" />
            لیست نوبت‌ها
          </TabsTrigger>
          <TabsTrigger value="new">
            <Plus className="h-4 w-4 ml-2" />
            نوبت جدید
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">فیلتر و جستجو</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>جستجو</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="نام مشتری یا آرایشگر..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                </div>

                <div>
                  <Label>وضعیت</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">همه</SelectItem>
                      <SelectItem value="PENDING_CONFIRMATION">نیاز به تأیید</SelectItem>
                      <SelectItem value="CONFIRMED">تأیید شده</SelectItem>
                      <SelectItem value="SETTLED">تسویه شده</SelectItem>
                      <SelectItem value="CANCELLED">لغو شده</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button onClick={loadAppointmentsAndSummary} variant="outline" className="w-full">
                    <RefreshCcw className="h-4 w-4 ml-2" />
                    بروزرسانی
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>نوبت‌ها ({filteredAndSortedAppointments.length})</span>
                {stats.pending > 0 && (
                  <span className="text-sm font-normal text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {stats.pending} نوبت نیاز به تأیید دارد
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                {loading ? 'در حال بارگذاری...' : 'مرتب شده بر اساس اولویت و زمان'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main-orange" />
                </div>
              ) : (
                <AppointmentList
                  appointments={filteredAndSortedAppointments}
                  userRole="ADMIN"
                  onRefresh={() => {
                    void loadAppointmentsAndSummary();
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new">
          <AppointmentForm role="ADMIN" onSuccess={handleFormSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
