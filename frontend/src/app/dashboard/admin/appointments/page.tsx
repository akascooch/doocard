'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Calendar, Search, Plus, RefreshCcw, Clock, CheckCircle, AlertCircle, DollarSign, Users, Filter, X, TrendingUp } from 'lucide-react';
import { AppointmentForm, AppointmentList } from '@/components/appointments';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import PersianDatePicker from '@/components/ui/PersianDatePicker';
import { jalaliToISO, getCurrentJalaliDate } from '@/lib/date';
import { formatCompactMoney } from '@/lib/money';
import { type EmployeeListItem, normalizeEmployeeList, getEmployeeDisplayName } from '@/lib/employee';

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
  employeeId?: number;
  notes?: string;
}

type Employee = EmployeeListItem;

// Helper function to get date range (timezone-safe)
const getDateRange = (filter: 'today' | 'tomorrow' | 'week' | 'all') => {
  const today = new Date();
  
  // Get local date components (no timezone conversion!)
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(today);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = getLocalDateString(weekEnd);

  switch (filter) {
    case 'today':
      // From today 00:00:00 to today 23:59:59
      return { 
        from: `${todayStr}T00:00:00`, 
        to: `${todayStr}T23:59:59` 
      };
    case 'tomorrow':
      // From tomorrow 00:00:00 to tomorrow 23:59:59
      return { 
        from: `${tomorrowStr}T00:00:00`, 
        to: `${tomorrowStr}T23:59:59` 
      };
    case 'week':
      // From today 00:00:00 to 7 days later 23:59:59
      return { 
        from: `${todayStr}T00:00:00`, 
        to: `${weekEndStr}T23:59:59` 
      };
    case 'all':
    default:
      return {};
  }
};

// Smart sorting: PENDING_CONFIRMATION first, then by scheduled time (nearest first)
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
    // First, sort by status priority
    const aPriority = statusPriority[a.status] || 99;
    const bPriority = statusPriority[b.status] || 99;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Then, sort by scheduled time (earliest first for today's appointments)
    return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
  });
};

export default function AdminAppointmentsPage() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'today' | 'tomorrow' | 'week' | 'all'>('today'); // Default to today
  
  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [dateMode, setDateMode] = useState<'quick' | 'single' | 'range'>('quick');
  const [singleDate, setSingleDate] = useState(getCurrentJalaliDate());
  const [dateFrom, setDateFrom] = useState(getCurrentJalaliDate());
  const [dateTo, setDateTo] = useState(getCurrentJalaliDate());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | 'ALL'>('ALL');

  useEffect(() => {
    console.log('🚀 Component mounted, loading employees...');
    loadEmployees();
  }, []);

  useEffect(() => {
    console.log('🔄 Filters changed, reloading appointments...', {
      showAdvancedFilters,
      dateFilter,
      dateMode,
      singleDate,
      dateFrom,
      dateTo,
      selectedEmployeeId
    });
    loadAppointments();
  }, [showAdvancedFilters, dateFilter, dateMode, singleDate, dateFrom, dateTo, selectedEmployeeId]);

  const loadEmployees = async () => {
    try {
      console.log('🔄 Loading employees...');
      const response = await api.get('/employees');
      console.log('✅ Loaded employees response:', response.data);
      console.log('✅ Employees count:', response.data?.length);
      console.log('✅ First employee:', response.data?.[0]);
      setEmployees(normalizeEmployeeList(response.data));
      console.log('✅ Employees state updated');
    } catch (error) {
      console.error('❌ Error loading employees:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری لیست آرایشگران با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      // Advanced Date Filters
      if (showAdvancedFilters) {
        if (dateMode === 'single' && singleDate) {
          // Single date: from 00:00 to 23:59
          const isoDateFull = jalaliToISO(singleDate);
          if (!isoDateFull) {
            console.error('❌ Failed to convert Jalali date to ISO:', singleDate);
            toast({
              title: 'خطا',
              description: 'تاریخ انتخاب شده نامعتبر است',
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
          const isoDate = isoDateFull.split('T')[0]; // فقط date، بدون time
          params.from = `${isoDate}T00:00:00`;
          params.to = `${isoDate}T23:59:59`;
          console.log('📅 Single date filter:', { jalali: singleDate, iso: isoDate, from: params.from, to: params.to });
        } else if (dateMode === 'range' && dateFrom && dateTo) {
          // Date range
          const isoFromFull = jalaliToISO(dateFrom);
          const isoToFull = jalaliToISO(dateTo);
          if (!isoFromFull || !isoToFull) {
            console.error('❌ Failed to convert Jalali dates to ISO:', { dateFrom, dateTo });
            toast({
              title: 'خطا',
              description: 'تاریخ‌های انتخاب شده نامعتبر هستند',
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
          const isoFrom = isoFromFull.split('T')[0]; // فقط date
          const isoTo = isoToFull.split('T')[0]; // فقط date
          params.from = `${isoFrom}T00:00:00`;
          params.to = `${isoTo}T23:59:59`;
          console.log('📅 Date range filter:', { 
            jalaliFrom: dateFrom, 
            jalaliTo: dateTo,
            isoFrom, 
            isoTo,
            from: params.from,
            to: params.to
          });
        }
        
        // Employee filter
        if (selectedEmployeeId !== 'ALL') {
          params.employeeId = selectedEmployeeId;
          console.log('👤 Employee filter:', selectedEmployeeId);
        }
      } else {
        // Quick date filters (original behavior)
        const dateRange = getDateRange(dateFilter);
        if (dateRange.from) params.from = dateRange.from;
        if (dateRange.to) params.to = dateRange.to;
        console.log('⚡ Quick filter:', dateFilter, dateRange);
      }

      console.log('📅 Final API params:', params);

      // Add search
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      // Add status filter
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const response = await api.get('/appointments', { params });
      console.log('📅 Loaded appointments response:', response.data);
      console.log('📅 Response type:', typeof response.data);
      console.log('📅 Is Array?', Array.isArray(response.data));
      
      const appointmentsData = response.data.data || response.data || [];
      console.log('📅 Setting appointments to:', appointmentsData);
      console.log('📅 Appointments count:', appointmentsData.length);
      
      setAppointments(appointmentsData);
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
  };

  const handleFormSuccess = () => {
    loadAppointments();
  };

  // Apply client-side filtering and sorting
  const filteredAndSortedAppointments = useMemo(() => {
    let filtered = appointments;

    // Filter by status
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((apt) => apt.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (apt) =>
          apt.customerName?.toLowerCase().includes(searchLower) ||
          apt.employeeName?.toLowerCase().includes(searchLower)
      );
    }

    // Smart sort: PENDING_CONFIRMATION first, then by time
    return sortAppointments(filtered);
  }, [appointments, statusFilter, searchTerm]);

  const stats = useMemo(() => {
    return {
      total: filteredAndSortedAppointments.length,
      pending: filteredAndSortedAppointments.filter((a) => a.status === 'PENDING_CONFIRMATION').length,
      confirmed: filteredAndSortedAppointments.filter((a) => a.status === 'CONFIRMED').length,
      completed: filteredAndSortedAppointments.filter((a) => a.status === 'SETTLED' || a.status === 'PAID').length,
    };
  }, [filteredAndSortedAppointments]);

  // Advanced Stats (for filtered appointments)
  const advancedStats = useMemo(() => {
    const totalAppointments = filteredAndSortedAppointments.length;
    const totalRevenue = filteredAndSortedAppointments.reduce((sum, apt) => {
      // فقط نوبت‌های تسویه شده را حساب می‌کنیم
      if ((apt.status === 'SETTLED' || apt.status === 'PAID') && apt.amount) {
        return sum + (apt.amount || 0);
      }
      return sum;
    }, 0);
    
    const settledCount = filteredAndSortedAppointments.filter(
      (a) => a.status === 'SETTLED' || a.status === 'PAID'
    ).length;

    return {
      totalAppointments,
      totalRevenue, // in Rials
      settledCount,
    };
  }, [filteredAndSortedAppointments]);

  // Clear advanced filters
  const clearAdvancedFilters = () => {
    setDateMode('quick');
    setDateFilter('today');
    setSingleDate(getCurrentJalaliDate());
    setDateFrom(getCurrentJalaliDate());
    setDateTo(getCurrentJalaliDate());
    setSelectedEmployeeId('ALL');
    setShowAdvancedFilters(false);
  };

  // Debug render
  console.log('🎨 Rendering with state:', {
    employees: employees.length,
    appointments: appointments.length,
    filteredAndSortedAppointments: filteredAndSortedAppointments.length,
    loading,
    showAdvancedFilters
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">مدیریت نوبت‌ها</h1>
        <p className="text-muted-foreground mt-1">
          {dateFilter === 'today' && 'نوبت‌های امروز'}
          {dateFilter === 'tomorrow' && 'نوبت‌های فردا'}
          {dateFilter === 'week' && 'نوبت‌های این هفته'}
          {dateFilter === 'all' && 'همه نوبت‌ها'}
          {' - '}
          ثبت، مشاهده و تسویه نوبت‌های سالن
        </p>
      </div>

      {/* Quick Date Filters & Advanced Filter Toggle */}
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
                setShowAdvancedFilters(!showAdvancedFilters);
                if (showAdvancedFilters) {
                  // Reverting to quick filters
                  setDateMode('quick');
                  setDateFilter('today');
                } else {
                  setDateMode('single');
                }
              }}
              className={cn(
                showAdvancedFilters && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Filter className="h-4 w-4 ml-2" />
              {showAdvancedFilters ? 'بازگشت به فیلتر سریع' : 'فیلتر پیشرفته'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!showAdvancedFilters ? (
            // Quick Filters
            <div className="flex flex-wrap gap-2">
              <Button
                variant={dateFilter === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('today')}
                className={cn(
                  'flex items-center gap-2',
                  dateFilter === 'today' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                <Clock className="h-4 w-4" />
                امروز
                {dateFilter === 'today' && stats.total > 0 && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {stats.total}
                  </span>
                )}
              </Button>
              <Button
                variant={dateFilter === 'tomorrow' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('tomorrow')}
                className={cn(
                  'flex items-center gap-2',
                  dateFilter === 'tomorrow' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                <Calendar className="h-4 w-4" />
                فردا
              </Button>
              <Button
                variant={dateFilter === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('week')}
                className={cn(
                  'flex items-center gap-2',
                  dateFilter === 'week' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                <Calendar className="h-4 w-4" />
                این هفته
              </Button>
              <Button
                variant={dateFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateFilter('all')}
                className={cn(
                  dateFilter === 'all' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                همه نوبت‌ها
              </Button>
            </div>
          ) : (
            // Advanced Filters
            <div className="space-y-4">
              {/* Date Mode Selector */}
              <div className="flex gap-2">
                <Button
                  variant={dateMode === 'single' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateMode('single')}
                  className={cn(
                    dateMode === 'single' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  یک روز
                </Button>
                <Button
                  variant={dateMode === 'range' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateMode('range')}
                  className={cn(
                    dateMode === 'range' && 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  بازه زمانی
                </Button>
              </div>

              {/* Date Pickers */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {dateMode === 'single' && (
                  <PersianDatePicker
                    value={singleDate}
                    onChange={setSingleDate}
                    label="تاریخ"
                    placeholder="مثال: ۱۴۰۳/۰۸/۰۷"
                  />
                )}
                {dateMode === 'range' && (
                  <>
                    <PersianDatePicker
                      value={dateFrom}
                      onChange={setDateFrom}
                      label="از تاریخ"
                      placeholder="مثال: ۱۴۰۳/۰۸/۰۱"
                    />
                    <PersianDatePicker
                      value={dateTo}
                      onChange={setDateTo}
                      label="تا تاریخ"
                      placeholder="مثال: ۱۴۰۳/۰۸/۳۰"
                      minDate={dateFrom}
                    />
                  </>
                )}

                {/* Employee Filter */}
                <div>
                  <Label>آرایشگر</Label>
                  <Select
                    value={selectedEmployeeId.toString()}
                    onValueChange={(value) => setSelectedEmployeeId(value === 'ALL' ? 'ALL' : Number(value))}
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

              {/* Clear Filters Button */}
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAdvancedFilters}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4 ml-2" />
                  پاک کردن فیلترها
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Stats (only shown when advanced filters are active) */}
      {showAdvancedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Calendar className="h-5 w-5" />
                تعداد کل نوبت‌ها
              </CardDescription>
              <CardTitle className="text-4xl text-blue-700 dark:text-blue-300">
                {advancedStats.totalAppointments}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                در بازه زمانی انتخاب شده
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white dark:from-green-950/20 dark:to-background">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                نوبت‌های تسویه شده
              </CardDescription>
              <CardTitle className="text-4xl text-green-700 dark:text-green-300">
                {advancedStats.settledCount}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                از {advancedStats.totalAppointments} نوبت
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[hsl(var(--primary))] bg-gradient-to-br from-[hsl(var(--primary))]/10 to-white dark:from-[hsl(var(--primary))]/5 dark:to-background">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2 text-[hsl(var(--primary))]">
                <DollarSign className="h-5 w-5" />
                مجموع درآمد
              </CardDescription>
              <CardTitle className="text-2xl text-[#8BC1A1]">
                {formatCompactMoney(advancedStats.totalRevenue)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                فقط نوبت‌های تسویه شده
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Cards */}
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
            <CardTitle className="text-3xl text-amber-600">
              {stats.pending}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              تأیید شده
            </CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {stats.confirmed}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              تسویه شده
            </CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {stats.completed}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
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

        {/* List Tab */}
        <TabsContent value="list" className="space-y-4">
          {/* Filters */}
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
                  <Button
                    onClick={loadAppointments}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCcw className="h-4 w-4 ml-2" />
                    بروزرسانی
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointments List */}
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main-orange"></div>
                </div>
              ) : (
                <AppointmentList
                  appointments={filteredAndSortedAppointments}
                  userRole="ADMIN"
                  onRefresh={loadAppointments}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Appointment Tab */}
        <TabsContent value="new">
          <AppointmentForm role="ADMIN" onSuccess={handleFormSuccess} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
