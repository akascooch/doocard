'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Overview } from '@/components/accounting/overview';
import { Transactions } from '@/components/accounting/transactions';
import { DailyTips } from '@/components/accounting/daily-tips';
import { BarberBalances } from '@/components/accounting/barber-balances';
import { Categories } from '@/components/accounting/categories';
import { BarberOverview } from '@/components/accounting/barber-overview';
import { BarberTransactions } from '@/components/accounting/barber-transactions';
import { getCurrentUser } from '@/lib/auth';
import dynamic from 'next/dynamic';

const BankAccountsPage = dynamic(() => import('./bank-accounts/page'), { ssr: false });
const SalaryManagement = dynamic(() => import('@/components/accounting/salary-management'), { ssr: false });

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">حسابداری</h2>
        </div>
        <div className="space-y-4">
          <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-96 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // اگر آرایشگر است، صفحه مخصوص آرایشگر را نشان بده
  if (user?.role === 'BARBER') {
    return (
      <div className="flex-1 space-y-4 p-8 pt-6">
        <div className="flex items-center justify-between space-y-2">
          <h2 className="text-3xl font-bold tracking-tight">حسابداری من</h2>
        </div>
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">نمای کلی</TabsTrigger>
            <TabsTrigger value="transactions">تراکنش‌های من</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <BarberOverview />
          </TabsContent>
          <TabsContent value="transactions" className="space-y-4">
            <BarberTransactions />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // اگر ادمین است، صفحه کامل حسابداری را نشان بده
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">حسابداری</h2>
      </div>
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="transactions">تراکنش‌ها</TabsTrigger>
          <TabsTrigger value="categories">دسته‌بندی‌ها</TabsTrigger>
          <TabsTrigger value="daily-tips">تیپ روزانه</TabsTrigger>
          <TabsTrigger value="barber-balances">موجودی آرایشگران</TabsTrigger>
          <TabsTrigger value="salary-management">مدیریت حقوق</TabsTrigger>
          <TabsTrigger value="bank-accounts">حساب‌های بانکی</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <Overview />
        </TabsContent>
        <TabsContent value="transactions" className="space-y-4">
          <Transactions onTabChange={setActiveTab} />
        </TabsContent>
        <TabsContent value="categories" className="space-y-4">
          <Categories />
        </TabsContent>
        <TabsContent value="daily-tips" className="space-y-4">
          <DailyTips />
        </TabsContent>
        <TabsContent value="barber-balances" className="space-y-4">
          <BarberBalances />
        </TabsContent>
        <TabsContent value="salary-management" className="space-y-4">
          <SalaryManagement />
        </TabsContent>
        <TabsContent value="bank-accounts" className="space-y-4">
          <BankAccountsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
} 