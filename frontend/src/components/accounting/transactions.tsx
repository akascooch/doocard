'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import api from '../../lib/axios';
import { getCurrentUser } from '../../lib/auth';
import { PersianDatePicker, isValidJalali } from '../../components/ui/persian-date-picker';
import * as jalaali from 'jalaali-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Category {
  id: number;
  name: string;
  type: 'INCOME' | 'EXPENSE';
  description: string | null;
}

interface Transaction {
  id: number;
  date: string;
  dateJalali: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: { id: number; name: string; type: string; description: string | null } | null;
  reference: string;
  bankAccount?: { id: number; name: string; cardNumber: string } | null;
}

interface BankAccount {
  id: number;
  name: string;
  cardNumber: string;
}

interface TransactionsProps {
  onTabChange?: (tab: string) => void;
}

export function Transactions({ onTabChange }: TransactionsProps) {
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('INCOME');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [reference, setReference] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [bankAccountFilter, setBankAccountFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showNewTransactionModal, setShowNewTransactionModal] = useState(false);
  const [date, setDate] = useState<Date>(new Date());

  // تعریف state و useEffect برای حساب‌های بانکی
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);
  useEffect(() => {
    api.get('/accounting/bank-accounts').then(res => setBankAccounts(res.data)).catch(() => setBankAccounts([]));
  }, []);

  // گرفتن دسته‌بندی‌ها
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await api.get('/accounting/categories');
        setCategories(response.data);
      } catch (error) {
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  // گرفتن تراکنش‌ها
  const fetchTransactions = async () => {
    try {
      const response = await api.get('/accounting/recent-transactions?limit=20');
      setTransactions(response.data);
    } catch (error) {
      setTransactions([]);
    }
  };
  useEffect(() => {
    fetchTransactions();
  }, []);

  // فیلتر تراکنش‌ها بر اساس دسته‌بندی و حساب بانکی
  const filteredTransactions = transactions
    .filter(t => categoryFilter === 'all' || t.category?.name === categoryFilter)
    .filter(t => bankAccountFilter === 'all' || t.bankAccount?.name === bankAccountFilter)
    .filter(t => typeFilter === 'all' || t.type === typeFilter)
    .sort((a, b) => {
      // اول بر اساس تاریخ (جدیدترین اول)
      const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateComparison !== 0) return dateComparison;
      
      // اگر تاریخ یکسان بود، بر اساس ID (جدیدترین اول)
      return b.id - a.id;
    });

  // ثبت یا ویرایش تراکنش
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = getCurrentUser();
    if (!user) {
      alert('ابتدا وارد شوید');
      return;
    }
    // در handleSubmit: اگر نوع تراکنش INCOME یا EXPENSE و حساب بانکی انتخاب نشده باشد، خطا بده
    if (!bankAccountId) {
      alert('حساب بانکی را انتخاب کنید');
      return;
    }
    // حالت درآمد/هزینه
    if (!categoryId) {
      alert('دسته‌بندی را انتخاب کنید');
      return;
    }
    // تبدیل تاریخ میلادی به ISO string
    const isoDate = date.toISOString();
    const entry = {
      type,
      amount: parseFloat(amount.replace(/,/g, '')),
      description,
      categoryId,
      reference,
      paymentMethod: 'CASH',
      date: isoDate,
      createdBy: Number(user.id),
      bankAccountId: bankAccountId || undefined,
    };
    try {
      if (editing) {
        await api.put(`/accounting/entries/${editing.id}`, entry);
        setEditing(null);
      } else {
        await api.post('/accounting/entries', entry);
      }
      setAmount('');
      setDescription('');
      setCategoryId(null);
      setReference('');
      setDate(new Date());
      setBankAccountId(null);
      fetchTransactions();
      setShowNewTransactionModal(false); // بستن مودال بعد از ثبت موفق
      alert('تراکنش با موفقیت ثبت شد!');
    } catch (error) {
      alert('خطا در ثبت تراکنش!');
    }
  };

  // حذف تراکنش
  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا مطمئن هستید که می‌خواهید این تراکنش را حذف کنید؟')) return;
    
    try {
      console.log('🗑️ Deleting transaction with id:', id);
      await api.delete(`/accounting/entries/${id}`);
      
      // حذف از state محلی
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      
      // نمایش پیام موفقیت
      alert('تراکنش با موفقیت حذف شد!');
      
    } catch (error: any) {
      console.error('❌ Error deleting transaction:', error);
      
      // نمایش پیام خطای مناسب
      let errorMessage = 'خطا در حذف تراکنش!';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`خطا در حذف تراکنش: ${errorMessage}`);
    }
  };

  // باز کردن فرم ویرایش
  const handleEdit = (transaction: Transaction) => {
    setEditing(transaction);
    setType(transaction.type);
    setAmount(String(transaction.amount));
    setDescription(transaction.description);
    setCategoryId(transaction.category?.id || null);
    setReference(transaction.reference);
    setDate(transaction.date ? new Date(transaction.date) : new Date());
    setBankAccountId((transaction as any).bankAccountId || null);
    setShowNewTransactionModal(true);
  };

  // بستن فرم ویرایش
  const closeEditModal = () => {
    setEditing(null);
    setShowNewTransactionModal(false);
    setAmount('');
    setDescription('');
    setCategoryId(null);
    setReference('');
    setBankAccountId(null);
  };

  // تابع فرمت سه‌رقمی مبلغ
  function formatAmountInput(value: string) {
    // حذف هر چیزی غیر از عدد
    const numeric = value.replace(/[^\d]/g, '');
    // تبدیل به عدد و سپس فرمت سه‌رقمی
    return numeric.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
      <Card className="col-span-1 lg:col-span-7">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <CardTitle>تراکنش‌های اخیر</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => onTabChange?.('categories')}
            >
              مدیریت دسته‌بندی‌ها
            </Button>
          </div>
          <Dialog open={showNewTransactionModal} onOpenChange={setShowNewTransactionModal}>
            <DialogTrigger asChild>
              <Button>ثبت تراکنش جدید</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{editing ? 'ویرایش تراکنش' : 'ثبت تراکنش جدید'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">نوع تراکنش</Label>
                  <Select defaultValue={type} onValueChange={v => setType(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOME">درآمد</SelectItem>
                      <SelectItem value="EXPENSE">هزینه</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* فیلدهای دسته‌بندی و حساب بانکی فقط برای درآمد/هزینه */}
                <div className="grid gap-2">
                  <Label htmlFor="category">دسته‌بندی</Label>
                  <Select onValueChange={v => setCategoryId(Number(v))} defaultValue={categoryId ? String(categoryId) : undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories
                        .filter((c) => c.type === type)
                        .map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {type !== 'TRANSFER' && (
                  <div className="grid gap-2">
                    <Label htmlFor="bankAccount">حساب بانکی</Label>
                    <Select onValueChange={v => setBankAccountId(Number(v))} defaultValue={bankAccountId ? String(bankAccountId) : undefined}>
                      <SelectTrigger>
                        <SelectValue placeholder="انتخاب کنید" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((b) => (
                          <SelectItem key={b.id} value={String(b.id)}>{b.name} ({b.cardNumber})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="amount">مبلغ (تومان)</Label>
                  <Input
                    id="amount"
                    type="text"
                    value={amount}
                    onChange={(e) => {
                      const formatted = formatAmountInput(e.target.value);
                      setAmount(formatted);
                    }}
                    placeholder="مبلغ را وارد کنید"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">توضیحات</Label>
                  <Input
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="توضیحات تراکنش (اختیاری)"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reference">شماره سند</Label>
                  <Input
                    id="reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="شماره فاکتور یا قبض را وارد کنید"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">تاریخ تراکنش</Label>
                  <PersianDatePicker
                    value={date}
                    onChange={(d) => d && setDate(d)}
                    placeholder="مثلاً 1402/11/22"
                  />
                </div>
                <div className="pt-4">
                  <Button type="submit" className="w-full">
                    {editing ? 'ویرایش تراکنش' : 'ثبت تراکنش'}
                  </Button>
                  {editing && (
                    <Button type="button" variant="outline" className="w-full mt-2" onClick={closeEditModal}>
                      انصراف از ویرایش
                    </Button>
                  )}
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Label>فیلتر دسته‌بندی:</Label>
              <Select onValueChange={setCategoryFilter} defaultValue={categoryFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="همه دسته‌بندی‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه دسته‌بندی‌ها</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>فیلتر نوع تراکنش:</Label>
              <Select onValueChange={setTypeFilter} defaultValue={typeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="همه انواع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه انواع</SelectItem>
                  <SelectItem value="INCOME">درآمد</SelectItem>
                  <SelectItem value="EXPENSE">هزینه</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label>فیلتر حساب بانکی:</Label>
              <Select onValueChange={setBankAccountFilter} defaultValue={bankAccountFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="همه حساب‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه حساب‌ها</SelectItem>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.name}>
                      {account.name} ({account.cardNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  setCategoryFilter('all');
                  setBankAccountFilter('all');
                  setTypeFilter('all');
                }}
              >
                پاک کردن فیلترها
              </Button>
            </div>
          </div>
          <div className="mb-4 text-sm text-gray-600">
            نمایش {filteredTransactions.length} تراکنش از {transactions.length} تراکنش کل
            {(categoryFilter !== 'all' || bankAccountFilter !== 'all' || typeFilter !== 'all') && (
              <span className="text-blue-600 font-medium">
                {' '}(فیلتر شده)
              </span>
            )}
            <div className="mt-2 text-xs text-gray-500">
              📅 تراکنش‌ها بر اساس تاریخ (جدیدترین اول) مرتب شده‌اند
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border rounded">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2">تاریخ و ساعت</th>
                  <th className="p-2">مبلغ</th>
                  <th className="p-2">نوع</th>
                  <th className="p-2">دسته‌بندی</th>
                  <th className="p-2">توضیحات</th>
                  <th className="p-2">حساب بانکی</th>
                  <th className="p-2">شماره سند</th>
                  <th className="p-2">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-2">
                      <div className="text-sm">
                                                <div>{t.dateJalali || '-'}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(t.date).toLocaleTimeString('fa-IR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </td>
                    <td className={`p-2 font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>{Math.abs(t.amount).toLocaleString('fa-IR')} تومان</td>
                    <td className="p-2">{t.type === 'INCOME' ? 'درآمد' : 'هزینه'}</td>
                    <td className="p-2">
                      {t.category ? (
                        <div className="flex items-center gap-2">
                          <span>{t.category.name}</span>
                          <Badge variant={t.category.type === 'INCOME' ? 'default' : 'destructive'} className="text-xs">
                            {t.category.type === 'INCOME' ? 'درآمد' : 'هزینه'}
                          </Badge>
                        </div>
                      ) : '-'}
                    </td>
                    <td className="p-2">{t.description}</td>
                    <td className="p-2 font-mono" dir="ltr">{t.bankAccount && t.bankAccount.name ? `${t.bankAccount.name} - ${t.bankAccount.cardNumber}` : '-'}</td>
                    <td className="p-2">{t.reference}</td>
                    <td className="p-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>ویرایش</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(t.id)}>حذف</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 