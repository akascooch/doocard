'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '../../lib/utils';
import api from '../../lib/axios';

interface BankAccount {
  id: number;
  name: string;
  cardNumber: string;
  balance?: number;
  createdAt: string;
  updatedAt: string;
}

export function BankBalances() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('🏦 Fetching bank accounts...');
        
        const response = await api.get('/accounting/bank-accounts');
        console.log('🏦 Bank accounts response:', response.data);
        
        // استفاده از داده‌های واقعی از سرور
        const accountsWithBalance = response.data.map((account: BankAccount) => ({
          ...account,
          balance: account.balance || 0
        }));
        
        setAccounts(accountsWithBalance);
      } catch (error) {
        console.error('❌ Error fetching bank accounts:', error);
        setError('خطا در بارگذاری حساب‌های بانکی');
        // در صورت خطا، آرایه خالی قرار بده
        setAccounts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBankAccounts();
  }, []);

  const totalBalance = accounts.reduce((sum, account) => sum + (account.balance || 0), 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>موجودی حساب‌های بانکی</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>موجودی حساب‌های بانکی</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-red-500">
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-white to-indigo-50 border-indigo-200 shadow-lg">
      <CardHeader className="border-b border-indigo-100">
        <CardTitle className="text-lg font-bold text-indigo-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            موجودی حساب‌های بانکی
          </div>
          <Badge variant="secondary" className="text-lg font-bold bg-indigo-100 text-indigo-800 hover:bg-indigo-200">
            {formatNumber(totalBalance)} تومان
          </Badge>
        </CardTitle>
        <p className="text-sm text-indigo-600">موجودی کل تمام حساب‌های بانکی</p>
      </CardHeader>
      <CardContent className="p-4">
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-gray-700">هیچ حساب بانکی یافت نشد</h3>
            <p className="mt-1 text-sm text-gray-500">
              برای شروع، یک حساب بانکی جدید اضافه کنید.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((account, index) => (
              <div
                key={account.id}
                className={`flex items-center justify-between p-4 border rounded-xl transition-all duration-200 hover:shadow-md ${
                  index === 0 
                    ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200 hover:from-blue-100 hover:to-cyan-100' 
                    : index === 1 
                    ? 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-200 hover:from-emerald-100 hover:to-teal-100'
                    : 'bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200 hover:from-purple-100 hover:to-violet-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-blue-100' : index === 1 ? 'bg-emerald-100' : 'bg-purple-100'
                  }`}>
                    <svg
                      className={`w-6 h-6 ${
                        index === 0 ? 'text-blue-600' : index === 1 ? 'text-emerald-600' : 'text-purple-600'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-lg">{account.name}</h4>
                    <p className="text-sm text-gray-500 font-mono">
                      {account.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${
                    index === 0 ? 'text-blue-700' : index === 1 ? 'text-emerald-700' : 'text-purple-700'
                  }`}>
                    {formatNumber(account.balance || 0)} تومان
                  </div>
                  <div className="text-xs text-gray-500">
                    موجودی فعلی
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 