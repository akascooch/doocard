'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { parseFromJalali } from '@/lib/date';
import { cn } from '@/lib/utils';

interface TimeSlot {
  time: string; // ISO string
  displayTime: string; // "09:00", "10:00", etc.
  available: boolean;
}

interface SlotPickerProfessionalProps {
  employeeId: number | null;
  date: string; // Jalali date YYYY/MM/DD
  durationMin: number;
  selectedTime: string | null; // ISO string
  onChange: (time: string | null) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export default function SlotPickerProfessional({
  employeeId,
  date,
  durationMin,
  selectedTime,
  onChange,
  label = 'زمان *',
  required = true,
  error,
}: SlotPickerProfessionalProps) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [firstAvailableSlot, setFirstAvailableSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employeeId && date && durationMin > 0) {
      loadSlots();
    } else {
      setSlots([]);
    }
  }, [employeeId, date, durationMin]);

  const loadSlots = async () => {
    if (!employeeId || !date) return;

    try {
      setLoading(true);
      
      // Convert Jalali to Gregorian (UTC)
      const gregorianDateObj = parseFromJalali(date);
      
      if (!gregorianDateObj) {
        throw new Error('Invalid date format');
      }
      
      const gregorianDate = gregorianDateObj.toISOString().split('T')[0]; // YYYY-MM-DD

      console.log(`🔄 Converting: ${date} → ${gregorianDate}`);

      const response = await api.get('/appointments/slots', {
        params: {
          employeeId,
          date: gregorianDate, // Send Gregorian date (YYYY-MM-DD)
          durationMin,
          bufferMin: 5,
          slotIntervalMin: 30,
        },
      });

      console.log('🕐 Available slots:', response.data);
      setSlots(response.data.slots || []);
      setFirstAvailableSlot(response.data.firstAvailableSlot ?? null);
    } catch (error: any) {
      console.error('Error loading slots:', error);
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'بارگذاری زمان‌های موجود با خطا مواجه شد',
        variant: 'destructive',
      });
      setSlots([]);
      setFirstAvailableSlot(null);
    } finally {
      setLoading(false);
    }
  };

  const selectSlot = (slot: TimeSlot) => {
    if (!slot.available) return;
    onChange(slot.time);
  };

  const selectFirstAvailable = () => {
    if (!firstAvailableSlot) return;
    onChange(firstAvailableSlot);
    setTimeout(() => {
      document.querySelector(`[data-slot-time="${firstAvailableSlot}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const getDisplayTime = (isoString: string): string => {
    const date = new Date(isoString);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  if (!employeeId || !date) {
    return (
      <div className="space-y-2">
        {label && (
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 mr-1">*</span>}
          </Label>
        )}
        <div className="p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-center">
          <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-500 dark:text-gray-300" />
          <p className="text-sm text-foreground/80">
            لطفاً ابتدا آرایشگر و تاریخ را انتخاب کنید
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {label && (
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 mr-1">*</span>}
          </Label>
        )}
        <div className="h-32 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-300" />
        </div>
      </div>
    );
  }

  const availableSlots = slots.filter(s => s.available);
  const busySlots = slots.filter(s => !s.available);

  return (
    <div className="space-y-3" dir="rtl">
      {label && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
            {required && <span className="text-red-500 mr-1">*</span>}
          </Label>
          <div className="flex items-center gap-2">
            {slots.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {availableSlots.length} زمان خالی
              </Badge>
            )}
            {firstAvailableSlot && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectFirstAvailable}
                className="text-xs"
              >
                اولین نوبت خالی
              </Button>
            )}
          </div>
        </div>
      )}

      {slots.length > 0 ? (
        <>
          {/* Available Slots */}
          {availableSlots.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 flex items-center">
                <div className="w-2 h-2 rounded-full bg-green-500 ml-2"></div>
                زمان‌های خالی
              </p>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {availableSlots.map((slot, index) => (
                  <Button
                    key={index}
                    type="button"
                    data-slot-time={slot.time}
                    variant={selectedTime === slot.time ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => selectSlot(slot)}
                    className={cn(
                      'text-base font-medium transition-all duration-200',
                      selectedTime === slot.time
                        ? 'bg-green-600 hover:bg-green-700 text-white border-green-600 shadow-lg scale-105'
                        : 'border-green-300 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950 text-green-700 dark:text-green-400'
                    )}
                  >
                    <Clock className="h-4 w-4 ml-1" />
                    {slot.displayTime}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Busy Slots (if any) */}
          {busySlots.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-2 flex items-center">
                <div className="w-2 h-2 rounded-full bg-red-500 ml-2"></div>
                زمان‌های پر
              </p>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {busySlots.map((slot, index) => (
                  <Button
                    key={index}
                    type="button"
                    data-slot-time={slot.time}
                    variant="outline"
                    size="lg"
                    disabled
                    className="text-base font-medium border-red-300 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 cursor-not-allowed opacity-60"
                  >
                    <Clock className="h-4 w-4 ml-1" />
                    {slot.displayTime}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Time Badge */}
          {selectedTime && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                زمان انتخاب شده: {getDisplayTime(selectedTime)}
              </span>
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-foreground/80">
            مدت زمان سرویس: {durationMin} دقیقه
          </p>
        </>
      ) : (
        <div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-xl border-2 border-amber-200 dark:border-amber-800 text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
            زمان خالی برای این تاریخ موجود نیست
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            لطفاً تاریخ دیگری انتخاب کنید
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 mt-1 flex items-center">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500 ml-2"></span>
          {error}
        </p>
      )}
    </div>
  );
}

