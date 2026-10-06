'use client';

import { BarberOverview } from '@/components/accounting/barber-overview';

export default function BarberDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">پنل کارمند</h1>
          <p className="mt-2 text-foreground">مدیریت حساب و درخواست‌های مالی</p>
        </div>
      </div>
      
      <BarberOverview />
    </div>
  );
}
