'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import { MonthlyChart } from './monthly-chart';
import { DateRangeFilter, DateRange } from './date-range-filter';

export function ChartWithFilters() {
  const [selectedRange, setSelectedRange] = useState<DateRange>(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1); // 1 ژانویه
    const endOfYear = new Date(now.getFullYear(), 11, 31); // 31 دسامبر
    return { from: startOfYear, to: endOfYear };
  });
  
  const [selectedType, setSelectedType] = useState<'6months' | '1year' | 'custom' | 'currentMonth' | 'currentYear'>('currentYear');

  const handleDateRangeChange = (range: DateRange, type: typeof selectedType) => {
    setSelectedRange(range);
    setSelectedType(type);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-800">
          نمودار درآمد و هزینه - سال شمسی {new Date().getFullYear()}
        </CardTitle>
        <p className="text-sm text-gray-600">
          نمایش داده‌ها بر اساس ماه‌های شمسی از فروردین تا اسفند
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* فیلتر تاریخ */}
        <div className="border-b pb-4">
          <DateRangeFilter
            onDateRangeChange={handleDateRangeChange}
            selectedRange={selectedRange}
            selectedType={selectedType}
          />
        </div>
        
        {/* نمودار */}
        <div className="pt-4">
          <MonthlyChart />
        </div>
        
        {/* توضیحات */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">📊 نحوه نمایش نمودار:</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>فروردین تا اسفند:</strong> ماه‌ها به ترتیب صحیح شمسی نمایش داده می‌شوند</li>
            <li>• <strong>درآمد (سبز):</strong> تمام تراکنش‌های مثبت و درآمدها</li>
            <li>• <strong>هزینه (قرمز):</strong> تمام تراکنش‌های منفی و هزینه‌ها</li>
            <li>• <strong>سود خالص:</strong> تفاوت درآمد و هزینه در هر ماه</li>
            <li>• <strong>شروع از مرداد 1404:</strong> داده‌ها از برج 5 (مرداد) شروع می‌شوند</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
