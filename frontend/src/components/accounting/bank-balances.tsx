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
            <div className="h-4 bg-accent rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-accent rounded w-1/2"></div>
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
          <div className="text-center py-4 text-destructive">
            <p>{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-card to-accent border-border shadow-lg">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-lg font-bold text-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            موجودی حساب‌های بانکی
          </div>
          <Badge variant="secondary" className="text-lg font-bold bg-accent text-foreground hover:bg-accent">
            {formatNumber(totalBalance)} تومان
          </Badge>
        </CardTitle>
        <p className="text-sm text-foreground">موجودی کل تمام حساب‌های بانکی</p>
      </CardHeader>
      <CardContent className="p-4">
        {accounts.length === 0 ? (
          <div className="text-center py-8 text-foreground">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-foreground">هیچ حساب بانکی یافت نشد</h3>
            <p className="mt-1 text-sm text-foreground">
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
                    ? 'bg-gradient-to-r from-accent to-accent border-border hover:from-accent hover:to-accent'
                    : index === 1 
                    ? 'bg-gradient-to-r from-accent to-accent border-border hover:from-accent hover:to-accent'
                    : 'bg-gradient-to-r from-accent to-accent border-border hover:from-accent hover:to-accent'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-accent' : index === 1 ? 'bg-accent' : 'bg-accent'
                  }`}>
                    <svg
                      className={`w-6 h-6 ${
                        index === 0 ? 'text-foreground' : index === 1 ? 'text-foreground' : 'text-foreground'
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground text-lg">{account.name}</h4>
                    <p className="text-sm text-foreground font-mono">
                      {account.cardNumber.replace(/(\d{4})/g, '$1 ').trim()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${
                    index === 0 ? 'text-foreground' : index === 1 ? 'text-foreground' : 'text-foreground'
                  }`}>
                    {formatNumber(account.balance || 0)} تومان
                  </div>
                  <div className="text-xs text-foreground">
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