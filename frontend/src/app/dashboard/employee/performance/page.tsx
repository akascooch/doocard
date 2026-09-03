'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function EmployeePerformancePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">عملکرد من</h1>
        <p className="text-muted-foreground">مشاهده آمار و عملکرد کاری</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            گزارش عملکرد
          </CardTitle>
          <CardDescription>
            آمار و نمودارهای عملکرد شما
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>این صفحه در حال توسعه است</p>
            <p className="text-sm mt-2">به زودی امکانات کامل اضافه خواهد شد</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

