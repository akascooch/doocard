'use client';

import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { format, subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { faIR } from 'date-fns/locale';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export interface DateRange {
  from: Date;
  to: Date;
}

export type DateFilterType = '6months' | '1year' | 'custom' | 'currentMonth' | 'currentYear';

interface DateRangeFilterProps {
  onDateRangeChange: (range: DateRange, type: DateFilterType) => void;
  selectedRange: DateRange;
  selectedType: DateFilterType;
}

const PRESET_RANGES = [
  {
    label: '6 ماه گذشته',
    type: '6months' as DateFilterType,
    getRange: () => ({
      from: startOfMonth(subMonths(new Date(), 6)),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: 'سال جاری',
    type: 'currentYear' as DateFilterType,
    getRange: () => ({
      from: startOfYear(new Date()),
      to: endOfYear(new Date()),
    }),
  },
  {
    label: 'ماه جاری',
    type: 'currentMonth' as DateFilterType,
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
  {
    label: 'سال گذشته',
    type: '1year' as DateFilterType,
    getRange: () => ({
      from: startOfYear(subYears(new Date(), 1)),
      to: endOfYear(subYears(new Date(), 1)),
    }),
  },
];

export function DateRangeFilter({ onDateRangeChange, selectedRange, selectedType }: DateRangeFilterProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<DateRange>(selectedRange);

  const handlePresetSelect = (preset: typeof PRESET_RANGES[0]) => {
    const range = preset.getRange();
    setTempRange(range);
    onDateRangeChange(range, preset.type);
  };

  const handleCustomRangeChange = (range: DateRange) => {
    setTempRange(range);
    if (range.from && range.to) {
      onDateRangeChange(range, 'custom');
      setIsCalendarOpen(false);
    }
  };

  const formatDateRange = (range: DateRange) => {
    if (!range.from || !range.to) return 'انتخاب بازه زمانی';
    
    const fromStr = format(range.from, 'dd MMM', { locale: faIR });
    const toStr = format(range.to, 'dd MMM yyyy', { locale: faIR });
    
    return `${fromStr} تا ${toStr}`;
  };

  const getPresetLabel = (type: DateFilterType) => {
    const preset = PRESET_RANGES.find(p => p.type === type);
    return preset ? preset.label : 'بازه سفارشی';
  };

  return (
    <div className="space-y-4">
      {/* نمایش بازه انتخاب شده */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm">
          {getPresetLabel(selectedType)}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatDateRange(selectedRange)}
        </span>
      </div>

      {/* دکمه‌های فیلترهای از پیش تعریف شده */}
      <div className="flex flex-wrap gap-2">
        {PRESET_RANGES.map((preset) => (
          <Button
            key={preset.type}
            variant={selectedType === preset.type ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetSelect(preset)}
            className="text-xs"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Separator />

      {/* انتخاب بازه سفارشی */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setIsCalendarOpen(!isCalendarOpen)}
          className="justify-start text-left font-normal"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          بازه سفارشی
        </Button>
        
        {isCalendarOpen && (
          <div className="absolute z-50 mt-2 bg-white border rounded-lg shadow-lg p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">از تاریخ</label>
                <Calendar
                  mode="single"
                  selected={tempRange.from}
                  onSelect={(date) => date && handleCustomRangeChange({ ...tempRange, from: date })}
                  locale={faIR}
                  className="rounded-md border"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">تا تاریخ</label>
                <Calendar
                  mode="single"
                  selected={tempRange.to}
                  onSelect={(date) => date && handleCustomRangeChange({ ...tempRange, to: date })}
                  locale={faIR}
                  className="rounded-md border"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCalendarOpen(false)}
              >
                انصراف
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (tempRange.from && tempRange.to) {
                    onDateRangeChange(tempRange, 'custom');
                    setIsCalendarOpen(false);
                  }
                }}
                disabled={!tempRange.from || !tempRange.to}
              >
                اعمال
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
