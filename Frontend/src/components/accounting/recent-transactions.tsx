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
        const response = await api.get('/accounting/recent-transactions');
        if (!response.data) throw new Error('خطا در دریافت تراکنش‌ها');
        const data = response.data;
        setTransactions(data);
      } catch (error) {
        setTransactions([]);
        alert('خطا در دریافت تراکنش‌ها!');
      }
    };
    fetchTransactions();
  }, []);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">تاریخ</TableHead>
          <TableHead className="text-right">شرح</TableHead>
          <TableHead className="text-right">دسته‌بندی</TableHead>
          <TableHead className="text-right">شماره سند</TableHead>
          <TableHead className="text-right">مبلغ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => (
          <TableRow key={transaction.id}>
            <TableCell className="text-right">{transaction.dateJalali || '-'}</TableCell>
            <TableCell className="text-right">{transaction.description}</TableCell>
            <TableCell className="text-right">{transaction.category?.name || '-'}</TableCell>
            <TableCell className="text-right">{transaction.reference}</TableCell>
            <TableCell className={`text-right font-bold ${transaction.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(Math.abs(transaction.amount))} تومان
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
} 