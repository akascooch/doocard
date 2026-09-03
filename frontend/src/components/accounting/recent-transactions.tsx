'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatNumber } from '../../lib/utils';
import api from '../../lib/axios';

interface Transaction {
  id: number;
  date: string;
  dateJalali: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: { id: number; name: string; type: string; description: string | null } | null;
  reference: string;
}

export function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await api.get('/accounting/recent-transactions?limit=10');
        if (!response.data) throw new Error('خطا در دریافت تراکنش‌ها');
        const data = response.data;
        // مرتب‌سازی بر اساس تاریخ و ساعت (جدیدترین اول)
        const sortedData = data.sort((a: any, b: any) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setTransactions(sortedData);
      } catch (error) {
        console.error('❌ Error fetching recent transactions:', error);
        setTransactions([]);
      }
    };
    fetchTransactions();
  }, []);

  return (
    <div className="space-y-3">
      {transactions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-700">هیچ تراکنشی یافت نشد</h3>
          <p className="mt-1 text-sm text-gray-500">
            هنوز تراکنشی ثبت نشده است.
          </p>
        </div>
      ) : (
        transactions.slice(0, 5).map((transaction, index) => (
          <div
            key={transaction.id}
            className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-200 hover:shadow-sm ${
              transaction.type === 'INCOME' 
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200 hover:from-green-100 hover:to-emerald-100' 
                : 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200 hover:from-red-100 hover:to-pink-100'
            }`}
          >
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                transaction.type === 'INCOME' ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <svg
                  className={`w-5 h-5 ${
                    transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-gray-900 text-sm truncate">
                  {transaction.description}
                </h4>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>{transaction.dateJalali || '-'}</span>
                  <span>•</span>
                  <span>{new Date(transaction.date).toLocaleTimeString('fa-IR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}</span>
                  <span>•</span>
                  <span>{transaction.category?.name || 'بدون دسته'}</span>
                  {transaction.reference && (
                    <>
                      <span>•</span>
                      <span className="font-mono">{transaction.reference}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`font-bold text-sm ${
                transaction.type === 'INCOME' ? 'text-green-700' : 'text-red-700'
              }`}>
                {transaction.type === 'INCOME' ? '+' : '-'} {formatNumber(Math.abs(transaction.amount))} تومان
              </div>
              <div className={`text-xs ${
                transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'
              }`}>
                {transaction.type === 'INCOME' ? 'درآمد' : 'هزینه'}
              </div>
            </div>
          </div>
        ))
      )}
      
      {transactions.length > 5 && (
        <div className="text-center pt-2">
          <button className="text-sm text-green-600 hover:text-green-700 font-medium">
            مشاهده همه تراکنش‌ها ({transactions.length})
          </button>
        </div>
      )}
    </div>
  );
} 