'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatNumber } from '../../lib/utils';
import api from '../../lib/axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Barber {
  id: number;
  firstName: string;
  lastName: string;
}

interface Salary {
  id: number;
  barberId: number;
  barberName: string;
  amount: number;
  month: string;
  isPaid: boolean;
  paidAt: string | null;
}

interface BarberBalance {
  id: number;
  name: string;
  totalIncome: number;
  totalWithdrawn: number;
  balance: number;
}
interface Withdrawal {
  id: number;
  barberId: number;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  bankAccount?: { id: number; name: string; cardNumber: string };
  paidAt?: string;
}

export function Salaries() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [selectedBarber, setSelectedBarber] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState('');
  const [editSalary, setEditSalary] = useState<Salary | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMonth, setEditMonth] = useState('');
  const [barberBalances, setBarberBalances] = useState<BarberBalance[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [withdrawBarber, setWithdrawBarber] = useState<BarberBalance | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [approveLoading, setApproveLoading] = useState<number | null>(null);
  const [rejectLoading, setRejectLoading] = useState<number | null>(null);
  const [bankAccounts, setBankAccounts] = useState<{id: number, name: string, cardNumber: string}[]>([]);
  const [approveDialog, setApproveDialog] = useState(false);
  const [approveWithdrawal, setApproveWithdrawal] = useState<Withdrawal | null>(null);
  const [selectedBankAccount, setSelectedBankAccount] = useState<number | null>(null);
  const [editWithdrawal, setEditWithdrawal] = useState<Withdrawal | null>(null);
  const [editWithdrawalAmount, setEditWithdrawalAmount] = useState('');
  const [editWithdrawalBank, setEditWithdrawalBank] = useState<number | null>(null);
  const [editWithdrawalLoading, setEditWithdrawalLoading] = useState(false);
  const [deleteWithdrawalId, setDeleteWithdrawalId] = useState<number | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [barbersResponse, salariesResponse] = await Promise.all([
          api.get('/barbers'),
          api.get('/accounting/salaries'),
        ]);
        if (!barbersResponse.data || !salariesResponse.data) throw new Error('خطا در دریافت اطلاعات');
        const barbersData = barbersResponse.data;
        const salariesData = salariesResponse.data;
        console.log('salariesResponse.data:', salariesData);
        setSalaries(salariesData.items || []);
      } catch (error) {
        setBarbers([]);
        setSalaries([]);
        alert('خطا در دریافت اطلاعات!');
      }
    };
    fetchData();
    api.get('/accounting/barbers/balances').then(res => setBarberBalances(res.data));
    api.get('/accounting/barber-withdrawals').then(res => setWithdrawals(res.data));
  }, []);

  console.log('salaries:', salaries);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/accounting/salaries', {
        barberId: parseInt(selectedBarber),
        amount: parseFloat(amount),
        month,
      });
      if (!response.data) throw new Error('خطا در ثبت حقوق');
      const data = response.data;
      setSalaries((prev) => Array.isArray(prev) ? [...prev, data] : [data]);
      setSelectedBarber('');
      setAmount('');
      setMonth('');
      alert('حقوق با موفقیت ثبت شد!');
    } catch (error) {
      alert('خطا در ثبت حقوق!');
    }
  };

  const handlePay = async (id: number) => {
    try {
      const response = await api.put(`/accounting/salaries/${id}/pay`);
      if (!response.data) throw new Error('خطا در پرداخت حقوق');
      setSalaries((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isPaid: true, paidAt: new Date().toISOString() } : s))
      );
      alert('حقوق پرداخت شد!');
    } catch (error) {
      alert('خطا در پرداخت حقوق!');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('آیا از حذف این حقوق مطمئن هستید؟')) return;
    try {
      await api.delete(`/accounting/salaries/${id}`);
      setSalaries((prev) => prev.filter((s) => s.id !== id));
      alert('حقوق حذف شد!');
    } catch (error) {
      alert('خطا در حذف حقوق!');
    }
  };

  const handleEdit = (salary: Salary) => {
    setEditSalary(salary);
    setEditAmount(salary.amount.toString());
    setEditMonth(salary.month);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSalary) return;
    try {
      const response = await api.put(`/accounting/salaries/${editSalary.id}`, {
        amount: parseFloat(editAmount),
        month: editMonth,
      });
      if (!response.data) throw new Error('خطا در ویرایش حقوق');
      setSalaries((prev) => prev.map((s) => s.id === editSalary.id ? { ...s, amount: parseFloat(editAmount), month: editMonth } : s));
      setEditSalary(null);
      alert('حقوق ویرایش شد!');
    } catch (error) {
      alert('خطا در ویرایش حقوق!');
    }
  };

  const openWithdrawDialog = (barber: BarberBalance) => {
    setWithdrawBarber(barber);
    setWithdrawAmount('');
    setWithdrawDialog(true);
  };
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawBarber) return;
    setWithdrawLoading(true);
    try {
      await api.post('/accounting/barber-withdrawals', { barberId: withdrawBarber.id, amount: Number(withdrawAmount) });
      setWithdrawDialog(false);
      setWithdrawAmount('');
      api.get('/accounting/barber-withdrawals').then(res => setWithdrawals(res.data));
      api.get('/accounting/barbers/balances').then(res => setBarberBalances(res.data));
      alert('درخواست برداشت ثبت شد و منتظر تایید ادمین است.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    setApproveLoading(id);
    try {
      await api.patch(`/accounting/barber-withdrawals/${id}/approve`, { adminId: 1 });
      api.get('/accounting/barber-withdrawals').then(res => setWithdrawals(res.data));
      api.get('/accounting/barbers/balances').then(res => setBarberBalances(res.data));
      alert('درخواست تایید و پرداخت شد.');
    } finally {
      setApproveLoading(null);
    }
  };
  const handleReject = async (id: number) => {
    setRejectLoading(id);
    try {
      await api.patch(`/accounting/barber-withdrawals/${id}/reject`, { adminId: 1 });
      api.get('/accounting/barber-withdrawals').then(res => setWithdrawals(res.data));
      api.get('/accounting/barbers/balances').then(res => setBarberBalances(res.data));
      alert('درخواست رد شد.');
    } finally {
      setRejectLoading(null);
    }
  };

  // گرفتن لیست حساب‌های بانکی
  useEffect(() => {
    api.get('/accounting/bank-accounts').then(res => setBankAccounts(res.data));
  }, []);
  const openApproveDialog = (w: Withdrawal) => {
    setApproveWithdrawal(w);
    setSelectedBankAccount(null);
    setApproveDialog(true);
  };
  const handleApproveFinal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveWithdrawal || !selectedBankAccount) return;
    setApproveLoading(approveWithdrawal.id);
    try {
      await api.patch(`/accounting/barber-withdrawals/${approveWithdrawal.id}/approve`, { adminId: 1, bankAccountId: selectedBankAccount });
      setApproveDialog(false);
      setApproveWithdrawal(null);
      setSelectedBankAccount(null);
      api.get('/accounting/barber-withdrawals').then(res => setWithdrawals(res.data));
      api.get('/accounting/barbers/balances').then(res => setBarberBalances(res.data));
      alert('درخواست تایید و پرداخت شد.');
    } finally {
      setApproveLoading(null);
    }
  };

  const openEditWithdrawal = (w: Withdrawal) => {
    setEditWithdrawal(w);
    setEditWithdrawalAmount(String(w.amount));
    setEditWithdrawalBank(w.bankAccount?.id || null);
  };
  const handleEditWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWithdrawal) return;
    setEditWithdrawalLoading(true);
    try {
      await api.put(`/accounting/barber-withdrawals/${editWithdrawal.id}`, { amount: Number(editWithdrawalAmount), bankAccountId: editWithdrawalBank });
      setEditWithdrawal(null);
      setEditWithdrawalAmount('');
      setEditWithdrawalBank(null);
      api.get('/accounting/barber-withdrawals').then(res => setWithdrawals(res.data));
      api.get('/accounting/barbers/balances').then(res => setBarberBalances(res.data));
      alert('درخواست ویرایش شد.');
    } finally {
      setEditWithdrawalLoading(false);
    }
  };
  const handleDeleteWithdrawal = async () => {
    if (!deleteWithdrawalId) return;
    await api.delete(`/accounting/barber-withdrawals/${deleteWithdrawalId}`);
    setDeleteWithdrawalId(null);
    api.get('/accounting/barber-withdrawals').then(res => setWithdrawals(res.data));
    api.get('/accounting/barbers/balances').then(res => setBarberBalances(res.data));
    alert('درخواست حذف شد.');
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
      {/* بخش جدید: لیست آرایشگران و برداشت */}
      <Card className="col-span-7">
        <CardHeader>
          <CardTitle>موجودی و برداشت آرایشگران</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="min-w-full text-sm border rounded mb-6">
            <thead>
              <tr className="bg-muted">
                <th className="p-2">نام آرایشگر</th>
                <th className="p-2">کل درآمد</th>
                <th className="p-2">کل برداشت</th>
                <th className="p-2">موجودی قابل برداشت</th>
                <th className="p-2">درخواست برداشت</th>
              </tr>
            </thead>
            <tbody>
              {barberBalances.map(b => (
                <tr key={b.id} className="border-b">
                  <td className="p-2 font-bold">{b.name}</td>
                  <td className="p-2">{formatNumber(b.totalIncome)} تومان</td>
                  <td className="p-2">{formatNumber(b.totalWithdrawn)} تومان</td>
                  <td className="p-2 font-bold text-blue-700">{formatNumber(b.balance)} تومان</td>
                  <td className="p-2">
                    <Button size="sm" variant="outline" onClick={() => openWithdrawDialog(b)} disabled={b.balance <= 0}>درخواست برداشت</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* تاریخچه درخواست‌های برداشت */}
          <div className="mb-2 font-bold">تاریخچه درخواست‌های برداشت</div>
          <table className="min-w-full text-sm border rounded">
            <thead>
              <tr className="bg-muted">
                <th className="p-2">آرایشگر</th>
                <th className="p-2">مبلغ</th>
                <th className="p-2">تاریخ</th>
                <th className="p-2">وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(w => {
                const barber = barberBalances.find(b => b.id === w.barberId);
                return (
                  <tr key={w.id} className="border-b">
                    <td className="p-2">{barber ? barber.name : '-'}</td>
                    <td className="p-2">{formatNumber(w.amount)} تومان</td>
                    <td className="p-2">{new Date(w.createdAt).toLocaleDateString('fa-IR')}</td>
                    <td className="p-2">
                      <Badge variant={w.status === 'APPROVED' ? 'success' : w.status === 'REJECTED' ? 'destructive' : 'outline'}>
                        {w.status === 'APPROVED' ? 'تایید شده' : w.status === 'REJECTED' ? 'رد شده' : 'در انتظار تایید'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* دیالوگ درخواست برداشت */}
          <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>درخواست برداشت از موجودی</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>آرایشگر: <b>{withdrawBarber?.name}</b></div>
                <div>موجودی: <b>{formatNumber(withdrawBarber?.balance || 0)} تومان</b></div>
                <div>
                  <Label>مبلغ برداشت</Label>
                  <Input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} min={1} max={withdrawBarber?.balance || 0} required />
                </div>
                <Button type="submit" className="w-full" disabled={withdrawLoading || !withdrawAmount || Number(withdrawAmount) > (withdrawBarber?.balance || 0)}>
                  {withdrawLoading ? 'در حال ثبت...' : 'ثبت درخواست'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      <Card className="col-span-7">
        <CardHeader>
          <CardTitle>مدیریت درخواست‌های برداشت آرایشگران (ادمین)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="min-w-full text-sm border rounded mb-6">
            <thead>
              <tr className="bg-muted">
                <th className="p-2">آرایشگر</th>
                <th className="p-2">مبلغ</th>
                <th className="p-2">تاریخ</th>
                <th className="p-2">وضعیت</th>
                <th className="p-2">حساب بانکی پرداخت</th>
                <th className="p-2">تاریخ پرداخت</th>
                <th className="p-2">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {withdrawals.map(w => {
                const barber = barberBalances.find(b => b.id === w.barberId);
                return (
                  <tr key={w.id} className="border-b">
                    <td className="p-2">{barber ? barber.name : '-'}</td>
                    <td className="p-2">{formatNumber(w.amount)} تومان</td>
                    <td className="p-2">{new Date(w.createdAt).toLocaleDateString('fa-IR')}</td>
                    <td className="p-2">
                      <Badge variant={w.status === 'APPROVED' ? 'success' : w.status === 'REJECTED' ? 'destructive' : 'outline'}>
                        {w.status === 'APPROVED' ? 'تایید شده' : w.status === 'REJECTED' ? 'رد شده' : 'در انتظار تایید'}
                      </Badge>
                    </td>
                    <td className="p-2 font-mono" dir="ltr">{w.bankAccount ? `${w.bankAccount.name} - ${w.bankAccount.cardNumber}` : '-'}</td>
                    <td className="p-2">{w.paidAt ? new Date(w.paidAt).toLocaleDateString('fa-IR') : '-'}</td>
                    <td className="p-2 flex gap-2">
                      {w.status === 'PENDING' && (
                        <>
                          <Button size="sm" variant="success" onClick={() => openApproveDialog(w)} disabled={approveLoading === w.id}>
                            تایید و پرداخت
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleReject(w.id)} disabled={rejectLoading === w.id}>
                            {rejectLoading === w.id ? 'در حال رد...' : 'رد'}
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEditWithdrawal(w)}>
                        ویرایش
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setDeleteWithdrawalId(w.id)}>
                        حذف
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* دیالوگ انتخاب حساب بانکی */}
          <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>انتخاب حساب بانکی برای پرداخت حقوق</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleApproveFinal} className="space-y-4">
                <div>مبلغ: <b>{formatNumber(approveWithdrawal?.amount || 0)} تومان</b></div>
                <div>
                  <Label>حساب بانکی</Label>
                  <Select onValueChange={v => setSelectedBankAccount(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(acc => (
                        <SelectItem key={acc.id} value={String(acc.id)}>{acc.name} ({acc.cardNumber})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={!selectedBankAccount || approveLoading === approveWithdrawal?.id}>
                  {approveLoading === approveWithdrawal?.id ? 'در حال پرداخت...' : 'تایید و پرداخت'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>ثبت حقوق جدید</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="barber">آرایشگر</Label>
              <Select onValueChange={setSelectedBarber} defaultValue={selectedBarber}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب آرایشگر" />
                </SelectTrigger>
                <SelectContent>
                  {barbers.map((barber) => (
                    <SelectItem key={barber.id} value={barber.id.toString()}>
                      {barber.firstName} {barber.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">مبلغ (تومان)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مبلغ را وارد کنید"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="month">ماه</Label>
              <Input
                id="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                placeholder="مثال: 1402/12"
              />
            </div>
            <Button type="submit" className="w-full">
              ثبت حقوق
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="col-span-4">
        <CardHeader>
          <CardTitle>لیست حقوق‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>آرایشگر</TableHead>
                <TableHead>ماه</TableHead>
                <TableHead>مبلغ</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تاریخ پرداخت</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(salaries) && salaries.length > 0 ? (
                [...salaries]
                  .sort((a, b) => {
                    // اگر paidAt وجود دارد، بر اساس آن مرتب شود، در غیر این صورت بر اساس id (فرض: id بزرگ‌تر جدیدتر)
                    const aDate = a.paidAt ? new Date(a.paidAt).getTime() : a.id;
                    const bDate = b.paidAt ? new Date(b.paidAt).getTime() : b.id;
                    return bDate - aDate;
                  })
                  .map((salary) => (
                    <TableRow key={salary.id}>
                      <TableCell>{salary.barberName}</TableCell>
                      <TableCell>{salary.month}</TableCell>
                      <TableCell>{formatNumber(salary.amount)} تومان</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            salary.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : salary.isPaid
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {salary.status === 'REJECTED'
                            ? 'رد شده'
                            : salary.isPaid
                            ? 'پرداخت شده'
                            : 'در انتظار پرداخت'}
                        </span>
                      </TableCell>
                      <TableCell>{salary.paidAt || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {!salary.isPaid && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePay(salary.id)}
                            >
                              پرداخت
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(salary)}
                          >
                            ویرایش
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(salary.id)}
                          >
                            حذف
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    هیچ حقوقی یافت نشد
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {/* Modal ویرایش */}
      {editSalary && (
        <Dialog open={!!editSalary} onOpenChange={() => setEditSalary(null)}>
          <DialogContent>
            <DialogTitle>ویرایش حقوق</DialogTitle>
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label>مبلغ (تومان)</Label>
                <Input
                  type="number"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>ماه</Label>
                <Input
                  value={editMonth}
                  onChange={(e) => setEditMonth(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">ثبت تغییرات</Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {/* دیالوگ ویرایش درخواست برداشت */}
      <Dialog open={!!editWithdrawal} onOpenChange={() => setEditWithdrawal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ویرایش درخواست برداشت</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditWithdrawal} className="space-y-4">
            <div>مبلغ فعلی: <b>{formatNumber(editWithdrawal?.amount || 0)} تومان</b></div>
            <div>
              <Label>مبلغ جدید</Label>
              <Input type="number" value={editWithdrawalAmount} onChange={e => setEditWithdrawalAmount(e.target.value)} min={1} required />
            </div>
            <div>
              <Label>حساب بانکی</Label>
              <Select onValueChange={v => setEditWithdrawalBank(Number(v))} defaultValue={editWithdrawalBank ? String(editWithdrawalBank) : undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map(acc => (
                    <SelectItem key={acc.id} value={String(acc.id)}>{acc.name} ({acc.cardNumber})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={editWithdrawalLoading}>
              {editWithdrawalLoading ? 'در حال ویرایش...' : 'ثبت ویرایش'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
      {/* دیالوگ حذف درخواست برداشت */}
      <Dialog open={!!deleteWithdrawalId} onOpenChange={() => setDeleteWithdrawalId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف درخواست برداشت</DialogTitle>
          </DialogHeader>
          <div>آیا از حذف این درخواست برداشت مطمئن هستید؟</div>
          <div className="flex gap-2 mt-4">
            <Button variant="destructive" onClick={handleDeleteWithdrawal}>حذف</Button>
            <Button variant="outline" onClick={() => setDeleteWithdrawalId(null)}>انصراف</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 