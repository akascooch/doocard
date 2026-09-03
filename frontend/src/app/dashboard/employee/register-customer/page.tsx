'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QuickRegisterCustomerForm } from '@/components/customers/QuickRegisterCustomerForm';
import { UserPlus } from 'lucide-react';

export default function RegisterCustomerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">ثبت مشتری</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          ثبت سریع مشتری فقط با نام و شماره موبایل
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" />
            فرم ثبت سریع
          </CardTitle>
          <CardDescription>
            مشتری به حساب شما مرتبط می‌شود. شماره باید با ۰۹ شروع شود.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuickRegisterCustomerForm />
        </CardContent>
      </Card>
    </div>
  );
}
