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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Search, Plus, RefreshCcw, Clock, CheckCircle, AlertCircle, SlidersHorizontal } from 'lucide-react';
import { AppointmentForm, AppointmentList } from '@/components/appointments';
import PersianDatePicker from '@/components/ui/PersianDatePicker';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
  getTehranTodayGregorian,
  tehranIsoFromGregorianDate,
  jalaliDayBoundsTehran,
  jalaliDateTimeTehranIso,
} from '@/lib/date';

interface Appointment {
  id: number;
  services: any[];
  scheduledAt: string;
  durationMin: number;
  status: string;
  amount?: number;
  tipAmount?: number;
  customerName: string;
  employeeName: string;
  notes?: string;
}

type PresetFilter = 'today' | 'tomorrow' | 'week' | 'all';
type FilterMode = 'preset' | 'singleDay' | 'dateTimeRange';
type AdvancedMode = 'singleDay' | 'dateTimeRange';

const addDaysGregorian = (gregorianDate: string, days: number): string => {
  const d = new Date(`${gregorianDate}T12:00:00+03:30`);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
};

const getPresetDateRange = (filter: PresetFilter): { from?: string; to?: string } => {
  const todayStr = getTehranTodayGregorian();
  const tomorrowStr = addDaysGregorian(todayStr, 1);
  const weekEndStr = addDaysGregorian(todayStr, 7);

  switch (filter) {
    case 'today':
      return {
        from: tehranIsoFromGregorianDate(todayStr, '00:00:00'),
        to: tehranIsoFromGregorianDate(todayStr, '23:59:59'),
      };
    case 'tomorrow':
      return {
        from: tehranIsoFromGregorianDate(tomorrowStr, '00:00:00'),
        to: tehranIsoFromGregorianDate(tomorrowStr, '23:59:59'),
      };
    case 'week':
      return {
        from: tehranIsoFromGregorianDate(todayStr, '00:00:00'),
        to: tehranIsoFromGregorianDate(weekEndStr, '23:59:59'),
      };
    case 'all':
    default:
      return {};
  }
};

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

export default function EmployeeAppointmentsPage() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<PresetFilter>('today');
  const [filterMode, setFilterMode] = useState<FilterMode>('preset');

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState<AdvancedMode>('singleDay');
  const [singleJalaliDate, setSingleJalaliDate] = useState('');
  const [rangeStartDate, setRangeStartDate] = useState('');
  const [rangeStartTime, setRangeStartTime] = useState('');
  const [rangeEndDate, setRangeEndDate] = useState('');
  const [rangeEndTime, setRangeEndTime] = useState('');
  const [advancedLabel, setAdvancedLabel] = useState('');

  const buildDateParams = useCallback((): { from?: string; to?: string } => {
    if (filterMode === 'preset') {
      return getPresetDateRange(dateFilter);
    }
    if (filterMode === 'singleDay' && singleJalaliDate) {
      return jalaliDayBoundsTehran(singleJalaliDate) || {};
    }
    if (filterMode === 'dateTimeRange' && rangeStartDate && rangeEndDate) {
      const from = jalaliDateTimeTehranIso(rangeStartDate, rangeStartTime);
      const to = jalaliDateTimeTehranIso(rangeEndDate, rangeEndTime);
      if (from && to) return { from, to };
    }
    return {};
  }, [
    filterMode,
    dateFilter,
    singleJalaliDate,
    rangeStartDate,
    rangeStartTime,
    rangeEndDate,
    rangeEndTime,
  ]);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      const dateRange = buildDateParams();
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'ALL') params.status = statusFilter;

      const response = await api.get('/appointments', { params });
      setAppointments(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error loading appointments:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری نوبت‌ها با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [buildDateParams, searchTerm, statusFilter, toast]);

  useEffect(() => {
    if (filterMode === 'preset') {
      loadAppointments();
    }
  }, [dateFilter, filterMode, loadAppointments]);

  const handlePresetClick = (preset: PresetFilter) => {
    setFilterMode('preset');
    setDateFilter(preset);
    setAdvancedLabel('');
  };

  const validateAdvanced = (): string | null => {
    if (advancedMode === 'singleDay') {
      if (!singleJalaliDate) return 'لطفاً تاریخ را انتخاب کنید.';
      if (!jalaliDayBoundsTehran(singleJalaliDate)) return 'تاریخ انتخاب شده نامعتبر است.';
      return null;
    }
    if (!rangeStartDate || !rangeStartTime || !rangeEndDate || !rangeEndTime) {
      return 'لطفاً بازه زمانی را کامل وارد کنید.';
    }
    const from = jalaliDateTimeTehranIso(rangeStartDate, rangeStartTime);
    const to = jalaliDateTimeTehranIso(rangeEndDate, rangeEndTime);
    if (!from || !to) return 'تاریخ یا زمان وارد شده نامعتبر است.';
    if (new Date(from).getTime() > new Date(to).getTime()) {
      return 'زمان شروع نمی‌تواند بعد از زمان پایان باشد.';
    }
    return null;
  };

  const applyAdvancedFilter = () => {
    const error = validateAdvanced();
    if (error) {
      toast({ title: 'خطا', description: error, variant: 'destructive' });
      return;
    }

    if (advancedMode === 'singleDay') {
      setFilterMode('singleDay');
      setAdvancedLabel(`یک روز: ${singleJalaliDate}`);
    } else {
      setFilterMode('dateTimeRange');
      setAdvancedLabel(`بازه: ${rangeStartDate} ${rangeStartTime} تا ${rangeEndDate} ${rangeEndTime}`);
    }
    setAdvancedOpen(false);
    setTimeout(() => loadAppointments(), 0);
  };

  const handleFormSuccess = () => {
    loadAppointments();
  };

  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = appointments;
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((apt) => apt.status === statusFilter);
    }
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter((apt) =>
        apt.customerName?.toLowerCase().includes(searchLower),
      );
    }
    return sortAppointments(filtered);
  }, [appointments, statusFilter, searchTerm]);

  const stats = useMemo(() => ({
    total: filteredAndSortedAppointments.length,
    pending: filteredAndSortedAppointments.filter((a) => a.status === 'PENDING_CONFIRMATION').length,
    confirmed: filteredAndSortedAppointments.filter((a) => a.status === 'CONFIRMED').length,
    completed: filteredAndSortedAppointments.filter(
      (a) => a.status === 'SETTLED' || a.status === 'PAID',
    ).length,
  }), [filteredAndSortedAppointments]);

  const subtitle =
    filterMode === 'preset'
      ? {
          today: 'نوبت‌های امروز شما',
          tomorrow: 'نوبت‌های فردا شما',
          week: 'نوبت‌های این هفته شما',
          all: 'همه نوبت‌های شما',
        }[dateFilter]
      : advancedLabel || 'فیلتر سفارشی';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">نوبت‌های من</h1>
        <p className="text-muted-foreground text-sm sm:text-base">{subtitle}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            فیلتر سریع زمانی
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['today', 'امروز', Clock],
                ['tomorrow', 'فردا', Calendar],
                ['week', 'این هفته', Calendar],
                ['all', 'همه', null],
              ] as const
            ).map(([key, label, Icon]) => (
              <Button
                key={key}
                variant={filterMode === 'preset' && dateFilter === key ? 'default' : 'outline'}
                size="sm"
                onClick={() => handlePresetClick(key)}
                className={cn(
                  'flex items-center gap-2 min-h-10',
                  filterMode === 'preset' && dateFilter === key && 'bg-primary text-primary-foreground',
                )}
              >
                {Icon && <Icon className="h-4 w-4" />}
                {label}
                {filterMode === 'preset' && dateFilter === key && key === 'today' && stats.total > 0 && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{stats.total}</span>
                )}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto min-h-10"
            onClick={() => setAdvancedOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4 ml-2" />
            فیلتر پیشرفته
            {filterMode !== 'preset' && advancedLabel && (
              <span className="mr-2 text-xs text-muted-foreground truncate max-w-[160px]">
                ({advancedLabel})
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent className="max-w-md w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>فیلتر پیشرفته</DialogTitle>
            <DialogDescription>انتخاب روز خاص یا بازه زمانی دقیق</DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={advancedMode === 'singleDay' ? 'default' : 'outline'}
              size="sm"
              className="min-h-10"
              onClick={() => setAdvancedMode('singleDay')}
            >
              یک روز خاص
            </Button>
            <Button
              type="button"
              variant={advancedMode === 'dateTimeRange' ? 'default' : 'outline'}
              size="sm"
              className="min-h-10"
              onClick={() => setAdvancedMode('dateTimeRange')}
            >
              بازه زمانی
            </Button>
          </div>

          {advancedMode === 'singleDay' ? (
            <div className="space-y-2">
              <Label>تاریخ</Label>
              <PersianDatePicker
                value={singleJalaliDate}
                onChange={setSingleJalaliDate}
                placeholder="انتخاب تاریخ"
                disablePortal
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label>تاریخ شروع</Label>
                  <PersianDatePicker
                    value={rangeStartDate}
                    onChange={setRangeStartDate}
                    placeholder="تاریخ شروع"
                    disablePortal
                  />
                </div>
                <div className="space-y-2">
                  <Label>ساعت شروع</Label>
                  <Input type="time" value={rangeStartTime} onChange={(e) => setRangeStartTime(e.target.value)} className="min-h-10" />
                </div>
                <div className="space-y-2">
                  <Label>تاریخ پایان</Label>
                  <PersianDatePicker
                    value={rangeEndDate}
                    onChange={setRangeEndDate}
                    placeholder="تاریخ پایان"
                    disablePortal
                  />
                </div>
                <div className="space-y-2">
                  <Label>ساعت پایان</Label>
                  <Input type="time" value={rangeEndTime} onChange={(e) => setRangeEndTime(e.target.value)} className="min-h-10" />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={() => setAdvancedOpen(false)} className="w-full sm:w-auto">
              انصراف
            </Button>
            <Button onClick={applyAdvancedFilter} className="w-full sm:w-auto">
              اعمال فیلتر
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs sm:text-sm">
              <Calendar className="h-4 w-4" />
              کل نوبت‌ها
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs sm:text-sm">
              <AlertCircle className="h-4 w-4" />
              نیاز به تأیید
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl text-amber-600">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs sm:text-sm">
              <CheckCircle className="h-4 w-4" />
              تأیید شده
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl text-blue-600">{stats.confirmed}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1 text-xs sm:text-sm">
              <CheckCircle className="h-4 w-4" />
              تسویه شده
            </CardDescription>
            <CardTitle className="text-2xl sm:text-3xl text-green-600">{stats.completed}</CardTitle>
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
                  <Label>جستجو مشتری</Label>
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="نام مشتری..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10 min-h-10"
                    />
                  </div>
                </div>
                <div>
                  <Label>وضعیت</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="min-h-10">
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
                  <Button onClick={loadAppointments} variant="outline" className="w-full min-h-10">
                    <RefreshCcw className="h-4 w-4 ml-2" />
                    بروزرسانی
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-lg">
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
                  userRole="EMPLOYEE"
                  onRefresh={loadAppointments}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new">
          <AppointmentForm role="EMPLOYEE" onSuccess={handleFormSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
