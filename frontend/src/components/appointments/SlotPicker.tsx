'use client';

import { useState, useEffect } from 'react';
import { Clock, Keyboard } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { GlassChip } from '@/components/ui/glass-chip';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { slotsApiDateFromPicker, snapToThirtyMinuteClock, tehranIsoFromGregorianDate } from '@/lib/date';

interface TimeSlot {
  time: string; // ISO string
  displayTime: string; // Persian formatted time like "14:30"
  available?: boolean;
  reason?: string;
}

interface SlotPickerProps {
  employeeId: number | null;
  date: string; // Jalali date YYYY/MM/DD or ISO date YYYY-MM-DD
  durationMin: number;
  selectedTime: string | null; // ISO string
  onChange: (time: string | null) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export default function SlotPicker({
  employeeId,
  date,
  durationMin,
  selectedTime,
  onChange,
  label = 'زمان *',
  required = true,
  error,
}: SlotPickerProps) {
  const { toast } = useToast();
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualTime, setManualTime] = useState('');

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
        } catch (error) {
          console.error('Error loading slots:', error);
          toast({
            title: 'خطا',
            description: 'بارگذاری زمان‌های موجود با خطا مواجه شد',
            variant: 'destructive',
          });
          setSlots([]);
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
    setManualMode(false);
  };

  const handleManualSubmit = () => {
    if (!manualTime.match(/^([0-1][0-9]|2[0-3]):([0-5][0-9])$/)) {
      toast({
        title: 'خطا',
        description: 'لطفاً زمان شروع نوبت را از اسلات‌های موجود انتخاب کنید.',
        variant: 'destructive',
      });
      return;
    }

    const snapped = snapToThirtyMinuteClock(manualTime);
    if (!snapped) {
      toast({
        title: 'خطا',
        description: 'لطفاً زمان شروع نوبت را از اسلات‌های موجود انتخاب کنید.',
        variant: 'destructive',
      });
      return;
    }

    const gregorianDate = slotsApiDateFromPicker(date);
    if (!gregorianDate) {
      toast({
        title: 'خطا',
        description: 'تاریخ نامعتبر است',
        variant: 'destructive',
      });
      return;
    }

    if (snapped !== manualTime) {
      toast({
        title: 'زمان تنظیم شد',
        description: `ساعت به نزدیک‌ترین اسلات ${snapped} منتقل شد.`,
      });
    }

    onChange(tehranIsoFromGregorianDate(gregorianDate, `${snapped}:00`));
    setManualMode(false);
    setManualTime('');
  };

  const getDisplayTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Tehran',
    });
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
        <div className="p-4 bg-white/[0.04] border border-white/10 rounded-lg text-center text-sm text-slate-300">
          لطفاً ابتدا آرایشگر و تاریخ را انتخاب کنید
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
        <div className="h-20 bg-white/[0.04] border border-white/10 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="space-y-2" dir="rtl">
      {label && (
        <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 mr-1">*</span>}
        </Label>
      )}

      {!manualMode ? (
        <>
          {slots.length > 0 ? (
            <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
              {slots.map((slot, index) => {
                const isUnavailable = slot.available === false;
                const isSelected = selectedTime === slot.time;
                return (
                <GlassChip
                  key={index}
                  selected={isSelected}
                  disabled={isUnavailable}
                  onClick={() => selectSlot(slot)}
                >
                  {slot.displayTime}
                  {isSelected ? <span className="sr-only">انتخاب شده</span> : null}
                </GlassChip>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-white/[0.04] border border-white/10 rounded-lg text-center text-sm text-slate-300">
              زمان خالی برای این تاریخ موجود نیست
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setManualMode(true)}
              className="text-xs"
            >
              <Keyboard className="h-3 w-3 ml-1" />
              ورود دستی زمان
            </Button>
            {selectedTime && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 ml-1" />
                انتخاب شده: {getDisplayTime(selectedTime)}
              </Badge>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              type="time"
              value={manualTime}
              onChange={(e) => setManualTime(e.target.value)}
              placeholder="14:30"
              className="text-center"
              dir="ltr"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleManualSubmit}
              className="bg-main-orange hover:bg-main-orange/90"
            >
              تأیید
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setManualMode(false);
                setManualTime('');
              }}
            >
              انصراف
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            فرمت: HH:MM (مثال: 14:30)
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}

      {slots.length > 0 && !manualMode && (
        <p className="text-xs text-muted-foreground">
          {slots.filter((s) => s.available !== false).length} زمان خالی موجود است • مدت زمان: {durationMin} دقیقه
        </p>
      )}
    </div>
  );
}

