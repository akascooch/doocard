'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Overview } from '@/components/accounting/overview';
import { Transactions } from '@/components/accounting/transactions';
import { Salaries } from '@/components/accounting/salaries';
import { Categories } from '@/components/accounting/categories';
import { DailyTips } from '@/components/accounting/daily-tips';
import dynamic from 'next/dynamic';
const BankAccountsPage = dynamic(() => import('./bank-accounts/page'), { ssr: false });

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">حسابداری</h2>
      </div>
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="transactions">تراکنش‌ها</TabsTrigger>
          <TabsTrigger value="salaries">حقوق و دستمزد</TabsTrigger>
          <TabsTrigger value="categories">دسته‌بندی‌ها</TabsTrigger>
          <TabsTrigger value="dailytips">تیپ روزانه</TabsTrigger>
          <TabsTrigger value="bankaccounts">حساب‌های بانکی</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <Overview />
        </TabsContent>
        <TabsContent value="transactions" className="space-y-4">
          <Transactions />
        </TabsContent>
        <TabsContent value="salaries" className="space-y-4">
          <Salaries />
        </TabsContent>
        <TabsContent value="categories" className="space-y-4">
          <Categories />
        </TabsContent>
        <TabsContent value="dailytips" className="space-y-4">
          <DailyTips />
        </TabsContent>
        <TabsContent value="bankaccounts" className="space-y-4">
          <BankAccountsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
} 