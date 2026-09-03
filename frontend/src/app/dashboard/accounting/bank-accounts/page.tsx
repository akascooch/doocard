"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from '@/lib/axios';
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from 'lucide-react';

const cardNumberRegex = /^\d{4}-\d{4}-\d{4}-\d{4}$/;

const bankAccountSchema = z.object({
  name: z.string().min(2, "نام حساب الزامی است"),
  cardNumber: z.string().regex(cardNumberRegex, "شماره کارت باید به صورت ۴ رقم-۴ رقم-۴ رقم-۴ رقم باشد"),
});

type BankAccountForm = z.infer<typeof bankAccountSchema>;

type BankAccount = {
  id: number;
  name: string;
  cardNumber: string;
  createdAt: string;
  updatedAt: string;
};

type BankAccountWithBalance = BankAccount & { balance?: number };

export default function BankAccountsPage() {
  const [accounts, setAccounts] = useState<BankAccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const { toast } = useToast();
  const [transferDialog, setTransferDialog] = useState(false);
  const [fromAccount, setFromAccount] = useState<string>("");
  const [toAccount, setToAccount] = useState<string>("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDesc, setTransferDesc] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsAccount, setDetailsAccount] = useState<BankAccountWithBalance | null>(null);
  const [detailsTransactions, setDetailsTransactions] = useState<any[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [defaultSettlementId, setDefaultSettlementId] = useState<number | null>(null);

  const form = useForm<BankAccountForm>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { name: "", cardNumber: "" },
  });

  useEffect(() => { fetchAccounts(); }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      accounts.forEach(async (acc) => {
        try {
          const res = await api.get(`/accounting/entries?page=1&limit=1000&bankAccountId=${acc.id}`);
          const entries = res.data.items.filter((e: any) => e.bankAccountId === acc.id);
          const income = entries.filter((e: any) => e.type === 'INCOME').reduce((sum: number, e: any) => sum + e.amount, 0);
          const expense = entries.filter((e: any) => e.type === 'EXPENSE').reduce((sum: number, e: any) => sum + e.amount, 0);
          acc.balance = income - expense;
          setAccounts((prev) => [...prev]);
        } catch {}
      });
    }
  }, [accounts.length]);

  // گرفتن مقدار پیش‌فرض از API
  useEffect(() => {
    api.get('/accounting/settings/default-settlement-bank-account')
      .then(res => {
        console.log('✅ Default settlement bank account:', res.data);
        setDefaultSettlementId(res.data.bankAccountId);
      })
      .catch(err => {
        console.error('❌ Error fetching default settlement bank account:', err);
        setDefaultSettlementId(null);
      });
  }, [accounts.length]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/accounting/bank-accounts");
      setAccounts(res.data);
    } catch {
      toast({ title: "خطا", description: "دریافت حساب‌های بانکی با مشکل مواجه شد", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: BankAccountForm) => {
    try {
      if (editing) {
        await api.patch(`/accounting/bank-accounts/${editing.id}`, data);
        toast({ title: "ویرایش موفق", description: "حساب بانکی ویرایش شد" });
      } else {
        await api.post("/accounting/bank-accounts", data);
        toast({ title: "ثبت موفق", description: "حساب بانکی جدید اضافه شد" });
      }
      setDialogOpen(false);
      setEditing(null);
      form.reset();
      fetchAccounts();
    } catch (e: any) {
      toast({ title: "خطا", description: e?.response?.data?.message || "عملیات با مشکل مواجه شد", variant: "destructive" });
    }
  };

  const handleEdit = (acc: BankAccount) => {
    setEditing(acc);
    form.reset({ name: acc.name, cardNumber: acc.cardNumber });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/accounting/bank-accounts/${id}`);
      toast({ title: "حذف موفق", description: "حساب بانکی حذف شد" });
      fetchAccounts();
    } catch {
      toast({ title: "خطا", description: "حذف حساب بانکی با مشکل مواجه شد", variant: "destructive" });
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromAccount || !toAccount || !transferAmount) {
      toast({ title: "خطا", description: "همه فیلدها الزامی است", variant: "destructive" });
      return;
    }
    if (fromAccount === toAccount) {
      toast({ title: "خطا", description: "حساب مبدا و مقصد نباید یکسان باشد", variant: "destructive" });
      return;
    }
    setTransferLoading(true);
    try {
      await api.post("/accounting/bank-accounts/transfer", {
        fromAccountId: Number(fromAccount),
        toAccountId: Number(toAccount),
        amount: Number(transferAmount.replace(/,/g, "")),
        description: transferDesc,
        createdBy: 1, // فرض: ادمین
      });
      toast({ title: "انتقال موفق", description: "مبلغ با موفقیت منتقل شد" });
      setTransferDialog(false);
      setFromAccount("");
      setToAccount("");
      setTransferAmount("");
      setTransferDesc("");
      fetchAccounts();
    } catch (e: any) {
      toast({ title: "خطا", description: e?.response?.data?.message || "انتقال با مشکل مواجه شد", variant: "destructive" });
    } finally {
      setTransferLoading(false);
    }
  };

  // تابع نمایش جزئیات
  const showDetails = async (acc: BankAccountWithBalance) => {
    setDetailsAccount(acc);
    setDetailsLoading(true);
    setDetailsOpen(true);
    try {
      const res = await api.get(`/accounting/bank-accounts/${acc.id}/transactions?limit=100`);
      setDetailsTransactions(res.data);
    } catch (error) {
      console.error('Error fetching bank account transactions:', error);
      setDetailsTransactions([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  // تابع انتخاب حساب پیش‌فرض
  const handleSetDefault = async (id: number) => {
    try {
      console.log('🔧 Setting default settlement bank account:', id);
      await api.post('/accounting/settings/default-settlement-bank-account', { bankAccountId: id });
      setDefaultSettlementId(id);
      toast({ title: 'حساب پیش‌فرض تسویه انتخاب شد.' });
    } catch (error: any) {
      console.error('❌ Error setting default settlement bank account:', error);
      toast({ 
        title: 'خطا', 
        description: error?.response?.data?.message || 'خطا در تنظیم حساب پیش‌فرض',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>مدیریت حساب‌های بانکی</CardTitle>
          <CardDescription>افزودن، ویرایش و حذف حساب بانکی با شماره کارت</CardDescription>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setEditing(null); form.reset(); } }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); form.reset(); }}>افزودن حساب جدید</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "ویرایش حساب بانکی" : "افزودن حساب بانکی جدید"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div>
                  <label className="block mb-1">نام حساب</label>
                  <Input {...form.register("name")}/>
                  {form.formState.errors.name && <div className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</div>}
                </div>
                <div>
                  <label className="block mb-1">شماره کارت</label>
                  <Input {...form.register("cardNumber")} placeholder="1234-5678-9012-3456" dir="ltr" maxLength={19}/>
                  {form.formState.errors.cardNumber && <div className="text-red-500 text-xs mt-1">{form.formState.errors.cardNumber.message}</div>}
                </div>
                <Button type="submit" className="w-full">{editing ? "ویرایش" : "افزودن"}</Button>
              </form>
            </DialogContent>
          </Dialog>
          <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">انتقال بین حساب‌ها</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>انتقال بین حساب‌های بانکی</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleTransfer} className="space-y-4">
                <div>
                  <label className="block mb-1">حساب مبدا</label>
                  <select className="w-full border rounded p-2" value={fromAccount} onChange={(e: any) => setFromAccount(e.target.value)}>
                    <option value="">انتخاب کنید</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} - {acc.cardNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1">حساب مقصد</label>
                  <select className="w-full border rounded p-2" value={toAccount} onChange={(e: any) => setToAccount(e.target.value)}>
                    <option value="">انتخاب کنید</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} - {acc.cardNumber}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1">مبلغ (تومان)</label>
                  <Input type="text" value={transferAmount} onChange={(e: any) => setTransferAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder="مثلاً 1000000" dir="ltr" />
                </div>
                <div>
                  <label className="block mb-1">توضیحات (اختیاری)</label>
                  <Input type="text" value={transferDesc} onChange={(e: any) => setTransferDesc(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={transferLoading}>{transferLoading ? "در حال انتقال..." : "انتقال"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>در حال بارگذاری...</div>
        ) : accounts.length === 0 ? (
          <div className="text-center text-muted-foreground">حساب بانکی‌ای ثبت نشده است.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border rounded">
              <thead>
                <tr className="bg-muted">
                  <th className="p-2">پیش‌فرض</th>
                  <th className="p-2">نام حساب</th>
                  <th className="p-2">شماره کارت</th>
                  <th className="p-2">موجودی</th>
                  <th className="p-2">تاریخ ایجاد</th>
                  <th className="p-2">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id} className="border-b">
                    <td className="p-2 text-center">
                      {defaultSettlementId === acc.id ? (
                        <CheckCircle2 className="text-green-600 inline" />
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleSetDefault(acc.id)}>انتخاب</Button>
                      )}
                    </td>
                    <td className="p-2 font-bold">{acc.name}</td>
                    <td className="p-2 font-mono" dir="ltr">{acc.cardNumber}</td>
                    <td className="p-2 font-bold text-blue-700">{typeof acc.balance === 'number' ? acc.balance.toLocaleString('fa-IR') + ' تومان' : '...'}</td>
                    <td className="p-2">{new Date(acc.createdAt).toLocaleDateString('fa-IR')}</td>
                    <td className="p-2 flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(acc)}>ویرایش</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>حذف</Button>
                      <Dialog open={detailsOpen && detailsAccount?.id === acc.id} onOpenChange={setDetailsOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => showDetails(acc)}>جزئیات</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>جزئیات حساب: {acc.name}</DialogTitle>
                          </DialogHeader>
                          <div className="mb-2 font-bold">موجودی: {detailsLoading ? '...' : detailsTransactions.reduce((sum, t) => sum + (t.type === 'INCOME' ? t.amount : -t.amount), 0).toLocaleString('fa-IR') + ' تومان'}</div>
                          {detailsLoading ? <div>در حال بارگذاری...</div> : (
                            <div className="overflow-x-auto max-h-96">
                              <table className="min-w-full text-sm border rounded">
                                <thead>
                                  <tr className="bg-muted">
                                    <th className="p-2">تاریخ و ساعت</th>
                                    <th className="p-2">شرح</th>
                                    <th className="p-2">مبلغ</th>
                                    <th className="p-2">نوع</th>
                                    <th className="p-2">دسته‌بندی</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailsTransactions.map((t) => (
                                    <tr key={t.id} className="border-b">
                                      <td className="p-2">
                                        <div className="text-sm">
                                          <div>{t.dateJalali || '-'}</div>
                                          <div className="text-xs text-gray-500">
                                            {new Date(t.createdAt).toLocaleTimeString('fa-IR', { 
                                              hour: '2-digit', 
                                              minute: '2-digit' 
                                            })}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="p-2">{t.description}</td>
                                      <td className={`p-2 font-bold ${t.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'INCOME' ? '+' : '-'} {Math.abs(t.amount).toLocaleString('fa-IR')} تومان
                                      </td>
                                      <td className="p-2">
                                        <span className={`px-2 py-1 rounded text-xs ${
                                          t.type === 'INCOME' 
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {t.type === 'INCOME' ? 'درآمد' : 'هزینه'}
                                        </span>
                                      </td>
                                      <td className="p-2">{t.category?.name || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {detailsTransactions.length === 0 && <div className="text-center text-muted-foreground mt-2">تراکنشی وجود ندارد.</div>}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 