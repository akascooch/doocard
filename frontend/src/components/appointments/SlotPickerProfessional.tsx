'use client';

import { useState, useEffect } from 'react';
import { Clock, Calendar, RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GlassChip } from '@/components/ui/glass-chip';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { slotsApiDateFromPicker } from '@/lib/date';

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
      const loadSlots = async () => {
        if (!employeeId || !date) return;

        try {
          setLoading(true);

          const gregorianDate = slotsApiDateFromPicker(date);
          if (!gregorianDate) {
            throw new Error('Invalid date format');
          }

          const response = await api.get('/appointments/slots', {
            params: {
              employeeId,
              date: gregorianDate,
              durationMin,
              bufferMin: 5,
              slotIntervalMin: 30,
            },
          });
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
      void loadSlots();
    } else {
      setSlots([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only / debounce-gated; function identity is not a data input
  }, [employeeId, date, durationMin]);

  const selectSlot = (slot: TimeSlot) => {
    if (slot.available === false) return;
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
          <Label className="text-sm font-medium text-foreground dark:text-foreground">
            {label}
            {required && <span className="text-destructive mr-1">*</span>}
          </Label>
        )}
        <div className="p-6 bg-gradient-to-br from-accent to-accent dark:from-background dark:to-background rounded-xl border-2 border-dashed border-border dark:border-border text-center">
          <Calendar className="h-8 w-8 mx-auto mb-2 text-foreground dark:text-foreground" />
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
          <Label className="text-sm font-medium text-foreground dark:text-foreground">
            {label}
            {required && <span className="text-destructive mr-1">*</span>}
          </Label>
        )}
        <div className="h-32 bg-accent border border-border rounded-xl animate-pulse flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-foreground dark:text-foreground" />
        </div>
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available !== false);
  const busySlots = slots.filter((s) => s.available === false);

  return (
    <div className="space-y-3" dir="rtl">
      {label && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <Label className="text-sm font-medium text-foreground dark:text-foreground">
            {label}
            {required && <span className="text-destructive mr-1">*</span>}
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
              <p className="text-xs text-foreground mb-2 flex items-center">
                <div className="w-2 h-2 rounded-full bg-primary ml-2"></div>
                زمان‌های خالی
              </p>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {availableSlots.map((slot, index) => {
                  const isSelected = selectedTime === slot.time;
                  return (
                  <GlassChip
                    key={index}
                    data-slot-time={slot.time}
                    selected={isSelected}
                    onClick={() => selectSlot(slot)}
                    className="text-base"
                  >
                    <Clock className="h-4 w-4 ml-1 shrink-0" aria-hidden />
                    {slot.displayTime}
                    {isSelected ? <span aria-hidden>✓</span> : null}
                    {isSelected ? <span className="sr-only">انتخاب شده</span> : null}
                  </GlassChip>
                  );
                })}
              </div>
            </div>
          )}

          {/* Busy Slots (if any) */}
          {busySlots.length > 0 && (
            <div>
              <p className="text-xs text-foreground mb-2 flex items-center">
                <div className="w-2 h-2 rounded-full bg-destructive ml-2"></div>
                زمان‌های پر
              </p>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {busySlots.map((slot, index) => (
                  <GlassChip
                    key={index}
                    data-slot-time={slot.time}
                    disabled
                    className="text-base"
                  >
                    <Clock className="h-4 w-4 ml-1 shrink-0" aria-hidden />
                    {slot.displayTime}
                    <span className="sr-only">رزرو شده</span>
                  </GlassChip>
                ))}
              </div>
            </div>
          )}

          {/* Selected Time Badge */}
          {selectedTime && (
            <div className="flex items-center gap-2 p-3 bg-accent dark:bg-primary rounded-lg border border-border dark:border-border">
              <Clock className="h-4 w-4 text-foreground dark:text-foreground" />
              <span className="text-sm font-medium text-foreground dark:text-foreground">
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
        <div className="p-6 bg-accent dark:bg-primary rounded-xl border-2 border-border dark:border-border text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 text-foreground" />
          <p className="text-sm text-foreground dark:text-foreground font-medium">
            زمان خالی برای این تاریخ موجود نیست
          </p>
          <p className="text-xs text-foreground dark:text-foreground mt-1">
            لطفاً تاریخ دیگری انتخاب کنید
          </p>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive mt-1 flex items-center">
          <span className="inline-block w-1 h-1 rounded-full bg-destructive ml-2"></span>
          {error}
        </p>
      )}
    </div>
  );
}

