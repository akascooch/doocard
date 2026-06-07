'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus } from 'lucide-react';
import { AppointmentForm, AppointmentList } from '@/components/appointments';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { getCurrentUser } from '@/lib/auth';

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

export default function CustomerAppointmentsPage() {
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    
    if (user) {
      loadCustomerId(user.id);
    }
  }, []);

  useEffect(() => {
    if (customerId) {
      loadAppointments();
    }
  }, [customerId]);

  const loadCustomerId = async (userId: number) => {
    try {
      const response = await api.get(`/customers/me`);
      console.log('📋 Customer data:', response.data);
      
      if (response.data && response.data.id) {
        setCustomerId(response.data.id);
      } else {
        toast({
          title: 'خطا',
          description: 'اطلاعات مشتری یافت نشد',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading customer:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری اطلاعات مشتری با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments');
      console.log('📅 Loaded customer appointments:', response.data);
      
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

  const pendingCount = appointments.filter(
    (a) => a.status === 'PENDING_CONFIRMATION'
  ).length;
  const confirmedCount = appointments.filter(
    (a) => a.status === 'CONFIRMED' || a.status === 'SETTLED'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">نوبت‌های من</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          مشاهده و رزرو نوبت جدید
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>کل نوبت‌ها</CardDescription>
            <CardTitle className="text-2xl">{appointments.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>در انتظار تأیید</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{pendingCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>تأیید شده</CardDescription>
            <CardTitle className="text-2xl text-green-600">{confirmedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="list">
            <Calendar className="h-4 w-4 ml-2" />
            نوبت‌های من
          </TabsTrigger>
          <TabsTrigger value="new">
            <Plus className="h-4 w-4 ml-2" />
            رزرو نوبت
          </TabsTrigger>
        </TabsList>

        {/* List Tab */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>نوبت‌های من ({appointments.length})</CardTitle>
              <CardDescription>
                {loading ? 'در حال بارگذاری...' : 'لیست نوبت‌های شما'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main-orange"></div>
                </div>
              ) : (
                <>
                  {pendingCount > 0 && (
                    <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        📌 {pendingCount} نوبت شما در انتظار تأیید توسط کارشناس است
                      </p>
                    </div>
                  )}
                  <AppointmentList
                    appointments={appointments}
                    userRole="CUSTOMER"
                    onRefresh={loadAppointments}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* New Appointment Tab */}
        <TabsContent value="new">
          {customerId ? (
            <>
              <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  ℹ️ نوبت شما پس از ثبت، توسط کارشناس تأیید خواهد شد و سپس قطعی می‌گردد
                </p>
              </div>
              <AppointmentForm 
                role="CUSTOMER" 
                customerId={customerId}
                onSuccess={handleFormSuccess} 
              />
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                در حال بارگذاری اطلاعات...
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
