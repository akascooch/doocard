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

export function Transactions() {
  const [type, setType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('INCOME');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [reference, setReference] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  // مقدار اولیه تاریخ شمسی امروز
  function getTodayJalali() {
    const today = new Date();
    const { jy, jm, jd } = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
  }
  const [date, setDate] = useState<string>(getTodayJalali());

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

  // فیلتر تراکنش‌ها بر اساس دسته‌بندی
  const filteredTransactions = categoryFilter === 'all'
    ? transactions
    : transactions.filter(t => t.category?.name === categoryFilter);

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
    // تبدیل تاریخ شمسی به میلادی
    let isoDate = new Date().toISOString();
    if (isValidJalali(date)) {
      const [jy, jm, jd] = date.split('/').map(Number);
      const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
      isoDate = new Date(gy, gm - 1, gd).toISOString();
    }
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
        setShowEditModal(false);
        setEditing(null);
      } else {
        await api.post('/accounting/entries', entry);
      }
      setAmount('');
      setDescription('');
      setCategoryId(null);
      setReference('');
      setDate(getTodayJalali());
      setBankAccountId(null);
      fetchTransactions();
      alert('تراکنش با موفقیت ثبت شد!');
    } catch (error) {
      alert('خطا در ثبت تراکنش!');
    }
  };

  // حذف تراکنش
  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا مطمئن هستید؟')) return;
    try {
      await api.delete(`/accounting/entries/${id}`);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      alert('تراکنش حذف شد!');
    } catch (error) {
      alert('خطا در حذف تراکنش!');
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
    setDate(transaction.dateJalali || getTodayJalali());
    setBankAccountId((transaction as any).bankAccountId || null);
    setShowEditModal(true);
  };

  // بستن فرم ویرایش
  const closeEditModal = () => {
    setEditing(null);
    setShowEditModal(false);
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>{editing ? 'ویرایش تراکنش' : 'ثبت تراکنش جدید'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                onChange={setDate}
                placeholder="مثلاً 1402/11/22"
              />
            </div>
            <Button type="submit" className="w-full">
              {editing ? 'ویرایش تراکنش' : 'ثبت تراکنش'}
            </Button>
            {editing && (
              <Button type="button" variant="outline" className="w-full mt-2" onClick={closeEditModal}>
                انصراف از ویرایش
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>تراکنش‌های اخیر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-2">
            <Label>فیلتر دسته‌بندی:</Label>
            <Select onValueChange={setCategoryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="همه دسته‌بندی‌ها" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="درآمد خدمات">درآمد خدمات</SelectItem>
                <SelectItem value="تیپ">تیپ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border rounded">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2">تاریخ</th>
                  <th className="p-2">شرح</th>
                  <th className="p-2">دسته‌بندی</th>
                  <th className="p-2">شماره سند</th>
                  <th className="p-2">حساب بانکی</th>
                  <th className="p-2">مبلغ</th>
                  <th className="p-2">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((t) => (
                  <tr key={t.id} className="border-b">
                    <td className="p-2">{t.dateJalali || '-'}</td>
                    <td className="p-2">{t.description}</td>
                    <td className="p-2">{t.category?.name || '-'}</td>
                    <td className="p-2">{t.reference}</td>
                    <td className="p-2 font-mono" dir="ltr">{t.bankAccount && t.bankAccount.name ? `${t.bankAccount.name} - ${t.bankAccount.cardNumber}` : '-'}</td>
                    <td className={`p-2 font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>{Math.abs(t.amount).toLocaleString('fa-IR')} تومان</td>
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