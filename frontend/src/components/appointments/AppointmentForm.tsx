'use client';

import { useState, useEffect, useRef } from 'react';
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
import { getCurrentUser } from '@/lib/auth';
import {
  FALLBACK_BOOKING_DURATION_MIN,
  effectiveServiceDurationMin,
  effectiveServicesDurationMin,
} from '@/lib/booking-duration';
import {
  getTehranTodayJalali,
  jalaliToApiDate,
  tehranHHmmFromIso,
} from '@/lib/date';
import { employeeUiIsLocked, findEmployeeIdForUser } from '@/lib/appointment-employee-lock';
import { getEmployeeDisplayName, normalizeEmployeeList } from '@/lib/employee';
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
import {
  type BarberLine,
  buildMultiBarberCreateBody,
  groupLinesByBarber,
  groupSpanMin,
} from '@/lib/booking-selections';

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
    date: '',
    time: null as string | null,
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [slotRefreshKey, setSlotRefreshKey] = useState(0);
  const [offlineCustomerOutboxId, setOfflineCustomerOutboxId] = useState<string | null>(null);
  const [offlineCustomerLabel, setOfflineCustomerLabel] = useState<string | null>(null);
  const [lockedEmployeeId, setLockedEmployeeId] = useState<number | null>(null);
  const [lockedEmployeeName, setLockedEmployeeName] = useState('');
  const lockEmployee = employeeUiIsLocked(role);
  const [lineEmployees, setLineEmployees] = useState<Record<number, number | null>>({});
  const [groupTimes, setGroupTimes] = useState<Record<number, string | null>>({});
  const groupKeyRef = useRef<string | null>(null);
  const perServiceBarber = role === 'ADMIN' && formData.serviceIds.length > 1;

  const setLineEmployee = (serviceId: number, employeeId: number | null) => {
    groupKeyRef.current = null;
    setLineEmployees((prev) => ({ ...prev, [serviceId]: employeeId }));
  };
  const setGroupTime = (employeeId: number, time: string | null) => {
    groupKeyRef.current = null;
    setGroupTimes((prev) => ({ ...prev, [employeeId]: time }));
  };
  const barberLines: BarberLine[] = perServiceBarber
    ? formData.serviceIds.flatMap((serviceId) => {
        const employeeId = lineEmployees[serviceId];
        const service = services.find((s) => s.id === serviceId);
        return employeeId && service
          ? [{ serviceId, employeeId, durationMin: effectiveServiceDurationMin(service) }]
          : [];
      })
    : [];
  const barberGroups = groupLinesByBarber(barberLines);

  const submitPerServiceBarber = async () => {
    const jalaliDate = jalaliToApiDate(formData.date);
    if (!jalaliDate || !formData.customerId) {
      toast({ title: 'خطا', description: 'مشتری و تاریخ معتبر الزامی است', variant: 'destructive' });
      return;
    }
    if (await shouldUseOfflineQueue()) {
      toast({
        title: 'خطا',
        description: 'ثبت نوبت با چند آرایشگر در حالت آفلاین پشتیبانی نمی‌شود',
        variant: 'destructive',
      });
      return;
    }
    const groupStartTimes: Record<number, string | null> = {};
    for (const group of barberGroups) {
      const iso = groupTimes[group.employeeId];
      groupStartTimes[group.employeeId] = iso ? tehranHHmmFromIso(iso) : null;
    }
    if (!groupKeyRef.current) groupKeyRef.current = crypto.randomUUID();
    const body = buildMultiBarberCreateBody({
      customerId: formData.customerId,
      jalaliDate,
      notes: formData.notes || undefined,
      clientOpId: groupKeyRef.current,
      lines: barberLines,
      groupStartTimes,
    });
    await api.post('/appointments', body);

    toast({ title: '✅ نوبت ثبت شد', description: '🎉 نوبت‌ها با موفقیت ثبت شدند' });
    groupKeyRef.current = null;
    setLineEmployees({});
    setGroupTimes({});
    setFormData({
      serviceIds: [],
      employeeId: null,
      customerId: null,
      date: getTehranTodayJalali(),
      time: null,
      notes: '',
    });
    if (onSuccess) onSuccess();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingServices(true);
        const response = await api.get('/services', { params: { sort: 'usage' } });
        const data = await cacheFromResponse(REFERENCE_KEYS.services, response.data);
        if (!cancelled) setServices(data);
      } catch (error) {
        console.error('Error loading services:', error);
        const cached = await getReferenceCache<Service[]>(REFERENCE_KEYS.services);
        if (cancelled) return;
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
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // One-shot catalog fetch on mount; toast is not a data input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setFormData((prev) => (prev.date ? prev : { ...prev, date: getTehranTodayJalali() }));
  }, []);

  useEffect(() => {
    if (!lockEmployee) return;
    const actorUserId = Number(getCurrentUser()?.id);
    let cancelled = false;
    api
      .get('/employees')
      .then((response) => {
        if (cancelled) return;
        const list = normalizeEmployeeList(response.data);
        const mine = findEmployeeIdForUser(list, Number.isInteger(actorUserId) ? actorUserId : undefined);
        if (mine == null) return;
        const row = list.find((employee) => employee.id === mine);
        setLockedEmployeeId(mine);
        setLockedEmployeeName(getEmployeeDisplayName(row));
        setFormData((prev) => ({ ...prev, employeeId: mine }));
      })
      .catch(() => {
        // Backend still derives employeeId from the JWT; keep the selector locked.
      });
    return () => {
      cancelled = true;
    };
  }, [lockEmployee]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (formData.serviceIds.length === 0) {
      newErrors.serviceIds = 'حداقل یک سرویس را انتخاب کنید';
    }

    if (perServiceBarber) {
      if (formData.serviceIds.some((id) => !lineEmployees[id])) {
        newErrors.employeeId = 'برای هر سرویس یک آرایشگر انتخاب کنید';
      } else if (barberGroups.some((group) => !groupTimes[group.employeeId])) {
        newErrors.time = 'برای هر آرایشگر زمان شروع را انتخاب کنید';
      }
    } else if (!lockEmployee && !formData.employeeId) {
      newErrors.employeeId = 'انتخاب آرایشگر الزامی است';
    }

    if (lockEmployee && lockedEmployeeId == null && !formData.employeeId) {
      newErrors.employeeId = 'پروفایل آرایشگر یافت نشد';
    }

    if (role !== 'CUSTOMER' && !formData.customerId && !offlineCustomerOutboxId) {
      newErrors.customerId = 'انتخاب مشتری الزامی است';
    }

    if (!formData.date) {
      newErrors.date = 'انتخاب تاریخ الزامی است';
    }

    if (!perServiceBarber && !formData.time) {
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

      if (perServiceBarber) {
        await submitPerServiceBarber();
        return;
      }

      const selectedServices = services.filter(s => formData.serviceIds.includes(s.id));
      const servicesPayload = selectedServices.map(s => ({
        serviceId: s.id,
        // Catalog rial only. The server recalculates and does not trust this total.
        priceAtBooking: s.price,
        durationMin: effectiveServiceDurationMin(s),
      }));

      const timeStr = tehranHHmmFromIso(formData.time!);
      if (!timeStr) {
        toast({
          title: 'خطا',
          description: 'زمان انتخاب‌شده نامعتبر است',
          variant: 'destructive',
        });
        return;
      }

      const jalaliDateFormatted = jalaliToApiDate(formData.date);
      if (!jalaliDateFormatted) {
        toast({
          title: 'خطا',
          description: 'تاریخ انتخاب‌شده نامعتبر است',
          variant: 'destructive',
        });
        return;
      }

      const employeeIdForPayload = lockEmployee
        ? lockedEmployeeId ?? formData.employeeId
        : formData.employeeId;
      if (lockEmployee && lockedEmployeeId != null && employeeIdForPayload !== lockedEmployeeId) {
        toast({
          title: 'خطا',
          description: 'ثبت نوبت فقط برای آرایشگر خودتان مجاز است',
          variant: 'destructive',
        });
        return;
      }

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
            employeeId: employeeIdForPayload!,
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
          employeeId: lockEmployee ? lockedEmployeeId : null,
          customerId: role === 'CUSTOMER' ? (customerId || null) : null,
          date: getTehranTodayJalali(),
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
        employeeId: employeeIdForPayload,
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
        employeeId: lockEmployee ? lockedEmployeeId : null,
        customerId: role === 'CUSTOMER' ? (customerId || null) : null,
        date: getTehranTodayJalali(),
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
  const totalDuration = selectedServices.length
    ? effectiveServicesDurationMin(selectedServices)
    : 0;
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  if (loadingServices) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-foreground" />
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
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6" dir="rtl" data-cy="appointment-form">
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
          {perServiceBarber ? (
            <div className="space-y-3 rounded-lg border border-border p-3" data-cy="per-service-barbers">
              <p className="text-sm text-muted-foreground">
                برای هر سرویس آرایشگر جداگانه انتخاب کنید؛ هر سرویس نوبت مستقل خودش را می‌گیرد.
                خدمات یک آرایشگر پشت سر هم چیده می‌شوند.
              </p>
              {formData.serviceIds.map((serviceId) => (
                <EmployeeSelectFiltered
                  key={serviceId}
                  selectedServiceIds={[serviceId]}
                  selectedEmployeeId={lineEmployees[serviceId] ?? null}
                  onChange={(id) => setLineEmployee(serviceId, id)}
                  label={`آرایشگر «${services.find((s) => s.id === serviceId)?.name ?? 'سرویس'}» *`}
                  required
                />
              ))}
              {errors.employeeId && <p className="text-sm text-destructive">{errors.employeeId}</p>}
            </div>
          ) : (
            <EmployeeSelectFiltered
              selectedServiceIds={formData.serviceIds}
              selectedEmployeeId={formData.employeeId}
              onChange={(id) => {
                if (lockEmployee) return;
                setFormData({ ...formData, employeeId: id });
              }}
              label="آرایشگر *"
              required
              error={errors.employeeId}
              locked={lockEmployee}
              lockedDisplayName={lockedEmployeeName}
            />
          )}

          {/* Customer Typeahead (only for ADMIN/EMPLOYEE) */}
          {role !== 'CUSTOMER' && (
            <CustomerTypeahead
              selectedCustomerId={formData.customerId}
              preferredEmployeeId={perServiceBarber ? barberLines[0]?.employeeId ?? null : formData.employeeId}
              scopeMine={role === 'EMPLOYEE'}
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
            <div className="text-sm text-foreground bg-accent dark:bg-primary rounded-lg p-2">
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
              className="jalali-date-picker"
            />
            {errors.date && <p className="text-sm text-destructive mt-1">{errors.date}</p>}
          </div>

          {/* Time Slot Picker */}
          {perServiceBarber ? (
            <div className="space-y-4">
              {barberGroups.map((group) => (
                <SlotPickerProfessional
                  key={`${slotRefreshKey}-${group.employeeId}`}
                  employeeId={group.employeeId}
                  date={formData.date}
                  durationMin={barberGroups.length > 1 ? groupSpanMin(group) : totalDuration}
                  selectedTime={groupTimes[group.employeeId] ?? null}
                  onChange={(time) => setGroupTime(group.employeeId, time)}
                  label={`زمان شروع: ${group.lines
                    .map((line) => services.find((s) => s.id === line.serviceId)?.name ?? 'سرویس')
                    .join('، ')} *`}
                  required
                />
              ))}
              {errors.time && <p className="text-sm text-destructive">{errors.time}</p>}
            </div>
          ) : (
            <SlotPickerProfessional
              key={slotRefreshKey}
              employeeId={formData.employeeId}
              date={formData.date}
              durationMin={selectedServices.length ? totalDuration : FALLBACK_BOOKING_DURATION_MIN}
              selectedTime={formData.time}
              onChange={(time) => setFormData({ ...formData, time })}
              label="زمان *"
              required
              error={errors.time}
            />
          )}

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
            <div className="bg-accent border border-border backdrop-blur-md rounded-lg p-4 space-y-2">
              <h3 className="font-semibold text-foreground">خلاصه نوبت:</h3>
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
                    <span className="font-bold text-foreground">
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
            data-cy="submit-appointment"
            className="w-full bg-primary hover:bg-accent"
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

