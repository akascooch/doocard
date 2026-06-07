'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

export default function EmployeeSalaryRequestPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">درخواست حقوق</h1>
        <p className="text-muted-foreground">مشاهده و مدیریت درخواست‌های حقوق</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            درخواست‌های حقوق
          </CardTitle>
          <CardDescription>
            ثبت و پیگیری درخواست‌های حقوق
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>این صفحه در حال توسعه است</p>
            <p className="text-sm mt-2">به زودی امکانات کامل اضافه خواهد شد</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

