'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function EmployeeSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">تنظیمات</h1>
        <p className="text-muted-foreground">مدیریت تنظیمات حساب کاربری</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            تنظیمات کاربری
          </CardTitle>
          <CardDescription>
            تنظیمات پروفایل و حساب کاربری
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Settings className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>این صفحه در حال توسعه است</p>
            <p className="text-sm mt-2">به زودی امکانات کامل اضافه خواهد شد</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

