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
import { Calendar, Search, Plus, RefreshCcw, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { AppointmentForm, AppointmentList } from '@/components/appointments';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { getCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { getTehranAppointmentPresetRange } from '@/lib/date';

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

type LegacyPresetFilter = 'today' | 'yesterday' | 'tomorrow' | 'week' | 'all';

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

export default function AppointmentsPage() {
  const { toast } = useToast();
  const currentUser = getCurrentUser();
  const userRole = currentUser?.role || 'CUSTOMER';
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<LegacyPresetFilter>('today');

  useEffect(() => {
    loadAppointments();
  }, [dateFilter]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const params: any = {};
      
      // Add date range filter (timezone-safe)
      const dateRange = getTehranAppointmentPresetRange(dateFilter);
      if (dateRange.from) params.from = dateRange.from;
      if (dateRange.to) params.to = dateRange.to;

      console.log('📅 [DEBUG] Date filter:', dateFilter);
      console.log('📅 [DEBUG] Date range:', dateRange);
      console.log('📅 [DEBUG] Current date:', new Date().toString());
      console.log('📅 [DEBUG] API params:', params);

      // Add search
      if (searchTerm) {
        params.search = searchTerm;
      }
      
      // Add status filter
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const response = await api.get('/appointments', { params });
      console.log('📅 [DEBUG] Loaded appointments:', response.data);
      console.log('📅 [DEBUG] Count:', response.data.data?.length || 0);
      
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">مدیریت نوبت‌ها</h1>
        <p className="text-muted-foreground mt-1">
          {dateFilter === 'today' && 'نوبت‌های امروز'}
          {dateFilter === 'yesterday' && 'نوبت‌های دیروز'}
          {dateFilter === 'tomorrow' && 'نوبت‌های فردا'}
          {dateFilter === 'week' && 'نوبت‌های این هفته'}
          {dateFilter === 'all' && 'همه نوبت‌ها'}
          {' - '}
          {userRole === 'ADMIN' && 'مدیریت کامل سالن'}
          {userRole === 'EMPLOYEE' && 'نوبت‌های شما'}
          {userRole === 'CUSTOMER' && 'نوبت‌های شما'}
        </p>
      </div>

      {/* Quick Date Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            فیلتر سریع زمانی
          </CardTitle>
        </CardHeader>
        <CardContent>
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
              variant={dateFilter === 'yesterday' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter('yesterday')}
              className={cn(
                'flex items-center gap-2',
                dateFilter === 'yesterday' && 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              <Clock className="h-4 w-4" />
              دیروز
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
        </CardContent>
      </Card>

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
          {(userRole === 'ADMIN' || userRole === 'EMPLOYEE') && (
            <TabsTrigger value="new">
              <Plus className="h-4 w-4 ml-2" />
              نوبت جدید
            </TabsTrigger>
          )}
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
                  userRole={userRole as 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER'}
                  onRefresh={loadAppointments}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Appointment Tab */}
        {(userRole === 'ADMIN' || userRole === 'EMPLOYEE') && (
          <TabsContent value="new">
            <AppointmentForm 
              role={userRole as 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER'} 
              onSuccess={handleFormSuccess} 
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
