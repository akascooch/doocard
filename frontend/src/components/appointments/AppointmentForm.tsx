'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ServicesMultiSelect,
  EmployeeSelectFiltered,
  CustomerTypeahead,
  SlotPickerProfessional,
} from '@/components/appointments';
import PersianDatePicker from '@/components/ui/PersianDatePicker';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { getCurrentJalaliDate, persianToEnglishDigits } from '@/lib/date';
import { Loader2 } from 'lucide-react';
import {
  shouldUseOfflineQueue,
  queueAppointmentCreate,
} from '@/lib/offline/sync-worker';
import {
  cacheFromResponse,
  getReferenceCache,
  hasMinimumReferenceCache,
  REFERENCE_KEYS,
} from '@/lib/offline/reference-cache';
import type { CustomerRef } from '@/lib/offline/types';

interface Service {
  id: number;
  name: string;
  price: number;
  durationMinutes: number;
  description?: string;
}

interface AppointmentFormProps {
  role: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
  customerId?: number; // Pre-fill for customer
  onSuccess?: () => void;
}

export default function AppointmentForm({ role, customerId, onSuccess }: AppointmentFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);

  const [formData, setFormData] = useState({
    serviceIds: [] as number[],
    employeeId: null as number | null,
    customerId: customerId || null as number | null,
    date: getCurrentJalaliDate(),
    time: null as string | null,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);
  const [offlineCustomerOutboxId, setOfflineCustomerOutboxId] = useState<string | null>(null);
  const [offlineCustomerLabel, setOfflineCustomerLabel] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoadingServices(true);
      const response = await api.get('/services');
      console.log('📋 Loaded services:', response.data);
      const data = await cacheFromResponse(REFERENCE_KEYS.services, response.data);
      setServices(data);
    } catch (error) {
      console.error('Error loading services:', error);
      const cached = await getReferenceCache<Service[]>(REFERENCE_KEYS.services);
      if (cached?.data?.length) {
        setServices(cached.data);
      } else {
        toast({
          title: 'خطا',
          description: 'بارگذاری سرویس‌ها با خطا مواجه شد',
          variant: 'destructive',
        });
      }
    } finally {
      setLoadingServices(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.serviceIds.length === 0) {
      newErrors.serviceIds = 'حداقل یک سرویس را انتخاب کنید';
    }

    if (!formData.employeeId) {
      newErrors.employeeId = 'انتخاب آرایشگر الزامی است';
    }

    if (role !== 'CUSTOMER' && !formData.customerId && !offlineCustomerOutboxId) {
      newErrors.customerId = 'انتخاب مشتری الزامی است';
    }

    if (!formData.date) {
      newErrors.date = 'انتخاب تاریخ الزامی است';
    }

    if (!formData.time) {
      newErrors.time = 'انتخاب زمان الزامی است';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast({
        title: 'خطا',
        description: 'لطفاً فیلدهای الزامی را پر کنید',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const selectedServices = services.filter(s => formData.serviceIds.includes(s.id));
      const servicesPayload = selectedServices.map(s => ({
        serviceId: s.id,
        priceAtBooking: s.price,
        durationMin: s.durationMinutes,
      }));

      const timeDate = new Date(formData.time!);
      const hours = timeDate.getHours().toString().padStart(2, '0');
      const minutes = timeDate.getMinutes().toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}`;

      const jalaliDateFormatted = persianToEnglishDigits(formData.date).replace(/\//g, '-');

      const useOffline = await shouldUseOfflineQueue();

      if (useOffline) {
        const hasCache = await hasMinimumReferenceCache();
        if (!hasCache || services.length === 0) {
          toast({
            title: 'خطا',
            description:
              'برای ثبت آفلاین نوبت، ابتدا باید اطلاعات پایه در حالت آنلاین بارگذاری شده باشد.',
            variant: 'destructive',
          });
          return;
        }

        let customerRef: CustomerRef;
        let dependsOn: string[] | undefined;

        if (role === 'CUSTOMER' && customerId) {
          customerRef = { kind: 'server', customerId };
        } else if (formData.customerId) {
          customerRef = { kind: 'server', customerId: formData.customerId };
        } else if (offlineCustomerOutboxId) {
          customerRef = { kind: 'outbox', outboxId: offlineCustomerOutboxId };
          dependsOn = [offlineCustomerOutboxId];
        } else {
          toast({
            title: 'خطا',
            description: 'مشتری برای ثبت آفلاین نوبت مشخص نیست',
            variant: 'destructive',
          });
          return;
        }

        const clientOpId = crypto.randomUUID();
        await queueAppointmentCreate(
          {
            clientOpId,
            customerRef,
            employeeId: formData.employeeId!,
            services: servicesPayload,
            jalaliDate: jalaliDateFormatted,
            time: timeStr,
            notes: formData.notes || undefined,
          },
          dependsOn,
        );

        toast({
          title: 'نوبت آفلاین',
          description:
            'نوبت به صورت آفلاین ثبت شد و پس از اتصال به سرور همگام‌سازی می‌شود.',
        });

        setFormData({
          serviceIds: [],
          employeeId: null,
          customerId: role === 'CUSTOMER' ? (customerId || null) : null,
          date: getCurrentJalaliDate(),
          time: null,
          notes: '',
        });
        setOfflineCustomerOutboxId(null);
        setOfflineCustomerLabel(null);

        if (onSuccess) onSuccess();
        return;
      }

      const payload = {
        services: servicesPayload,
        employeeId: formData.employeeId,
        customerId: role === 'CUSTOMER' ? customerId : formData.customerId,
        jalaliDate: jalaliDateFormatted,
        time: timeStr,
        notes: formData.notes || undefined,
      };

      console.log('📤 Submitting appointment:', payload);

      const response = await api.post('/appointments', payload);
      console.log('✅ Appointment created:', response.data);

      toast({
        title: role === 'CUSTOMER' ? '✅ درخواست ثبت شد' : '✅ نوبت ثبت شد',
        description:
          role === 'CUSTOMER'
            ? '💈 درخواست نوبت شما ثبت شد و در انتظار تأیید آرایشگر است'
            : '🎉 نوبت با موفقیت ثبت شد',
      });

      // Reset form
      setFormData({
        serviceIds: [],
        employeeId: null,
        customerId: role === 'CUSTOMER' ? (customerId || null) : null,
        date: getCurrentJalaliDate(),
        time: null,
        notes: '',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('❌ Error creating appointment:', error);
      
      // Extract error message from backend
      const errorMessage = error.response?.data?.message || error.message || 'ثبت نوبت با خطا مواجه شد';
      
      // Check if it's a slot conflict error
      const isSlotConflict = errorMessage.includes('تداخل') || 
                              errorMessage.includes('رزرو شده') || 
                              errorMessage.toLowerCase().includes('conflict') ||
                              error.response?.status === 409;
      
      console.log('🔍 Error details:', {
        message: errorMessage,
        status: error.response?.status,
        isSlotConflict
      });
      
      // Show appropriate error message
      toast({
        title: isSlotConflict ? '⚠️ ساعت رزرو شده' : '❌ خطا',
        description: isSlotConflict 
          ? 'این ساعت قبلاً رزرو شده است. لطفاً ساعت دیگری انتخاب کنید.'
          : errorMessage,
        variant: 'destructive',
      });
      
      // If slot conflict, refresh time slots to show updated availability
      if (isSlotConflict) {
        console.log('🔄 Refreshing time slots after conflict...');
        setSlotRefreshKey(prev => prev + 1); // Force SlotPicker to reload
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedServices = services.filter(s => formData.serviceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  if (loadingServices) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-main-orange" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card dir="rtl">
      <CardHeader>
        <CardTitle>ثبت نوبت جدید</CardTitle>
        <CardDescription>
          {role === 'CUSTOMER'
            ? 'سرویس‌های مورد نظر و زمان دلخواه خود را انتخاب کنید'
            : 'اطلاعات نوبت را وارد کنید'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6">
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6" dir="rtl">
          {/* Services Multi-Select */}
          <ServicesMultiSelect
            services={services}
            selectedServiceIds={formData.serviceIds}
            onChange={(ids) => setFormData({ ...formData, serviceIds: ids })}
            label="سرویس‌ها *"
            required
            error={errors.serviceIds}
            hidePrices={role === 'CUSTOMER'}
          />

          {/* Employee Select (filtered by services) */}
          <EmployeeSelectFiltered
            selectedServiceIds={formData.serviceIds}
            selectedEmployeeId={formData.employeeId}
            onChange={(id) => setFormData({ ...formData, employeeId: id })}
            label="آرایشگر *"
            required
            error={errors.employeeId}
          />

          {/* Customer Typeahead (only for ADMIN/EMPLOYEE) */}
          {role !== 'CUSTOMER' && (
            <CustomerTypeahead
              selectedCustomerId={formData.customerId}
              onChange={(id) => {
                setFormData({ ...formData, customerId: id });
                if (id) {
                  setOfflineCustomerOutboxId(null);
                  setOfflineCustomerLabel(null);
                }
              }}
              onOfflineCustomerQueued={(outboxId, label) => {
                setOfflineCustomerOutboxId(outboxId);
                setOfflineCustomerLabel(label);
                setFormData({ ...formData, customerId: null });
              }}
              label="مشتری *"
              required
              error={errors.customerId}
            />
          )}

          {offlineCustomerLabel && (
            <div className="text-sm text-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2">
              مشتری آفلاین: {offlineCustomerLabel}{' '}
              <span className="text-xs">(در انتظار همگام‌سازی)</span>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <PersianDatePicker
              value={formData.date}
              onChange={(date) => setFormData({ ...formData, date })}
              label="تاریخ *"
              placeholder="مثال: ۱۴۰۳/۰۷/۲۱"
            />
            {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* Time Slot Picker */}
          <SlotPickerProfessional
            key={slotRefreshKey}
            employeeId={formData.employeeId}
            date={formData.date}
            durationMin={60}
            selectedTime={formData.time}
            onChange={(time) => setFormData({ ...formData, time })}
            label="زمان *"
            required
            error={errors.time}
          />

          {/* Notes */}
          <div>
            <Label>یادداشت (اختیاری)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="توضیحات اضافی..."
              rows={3}
            />
          </div>

          {/* Summary (only show price for non-customers) */}
          {formData.serviceIds.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              <h3 className="font-semibold">خلاصه نوبت:</h3>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تعداد سرویس:</span>
                  <span className="font-medium">{selectedServices.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">مدت زمان کل:</span>
                  <span className="font-medium">{totalDuration} دقیقه</span>
                </div>
                {role !== 'CUSTOMER' && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">مجموع قیمت:</span>
                    <span className="font-bold text-main-orange">
                      {new Intl.NumberFormat('fa-IR').format(totalPrice / 10)} تومان
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-main-orange hover:bg-main-orange/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
                در حال ثبت...
              </>
            ) : (
              'ثبت نوبت'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

