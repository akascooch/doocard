'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Edit, Phone, Search, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import axios from '@/lib/axios';
import { formatToJalali } from '@/lib/date';
import { normalizeIranMobileClient } from '@/components/customers/QuickRegisterCustomerForm';

interface MyCustomerRow {
  id: number;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

const IRAN_MOBILE_RE = /^09\d{9}$/;

export default function MyCustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<MyCustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editing, setEditing] = useState<MyCustomerRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      // mine=1 scopes to current employee's preferred customers (JWT-derived)
      const response = await axios.get('/customers', {
        params: { mine: '1' },
      });
      const mapped = (response.data || []).map((c: any) => ({
        id: c.id,
        name: c.user?.name || '—',
        phone: c.user?.phone || '—',
        email: c.user?.email || undefined,
        notes: c.notes || '',
        createdAt: c.createdAt,
      }));
      setCustomers(mapped);
    } catch (error: any) {
      console.error('Error loading my customers:', error);
      toast({
        title: 'خطا',
        description:
          error.response?.data?.message || 'بارگذاری مشتریان من با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (c: MyCustomerRow) => {
    setEditing(c);
    setEditName(c.name === '—' ? '' : c.name);
    setEditPhone(c.phone === '—' ? '' : c.phone);
  };

  const handleSave = async () => {
    if (!editing) return;
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast({
        title: 'خطا',
        description: 'نام مشتری الزامی است',
        variant: 'destructive',
      });
      return;
    }
    const normalizedPhone = normalizeIranMobileClient(editPhone);
    if (!IRAN_MOBILE_RE.test(normalizedPhone)) {
      toast({
        title: 'خطا',
        description: 'شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);
      await axios.patch(`/customers/${editing.id}`, {
        name: trimmedName,
        phone: normalizedPhone,
      });
      toast({
        title: 'موفق',
        description: 'اطلاعات مشتری به‌روزرسانی شد',
      });
      setEditing(null);
      await load();
    } catch (error: any) {
      toast({
        title: 'خطا',
        description:
          error.response?.data?.message || 'به‌روزرسانی مشتری با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const filtered = customers.filter((c) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(searchTerm) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">مشتریان من</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          مشتریانی که آرایشگر ترجیحی آن‌ها شما هستید — می‌توانید نام و موبایل را ویرایش کنید
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">تعداد مشتریان من</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>جستجو</CardTitle>
          <CardDescription>فیلتر محلی روی لیست بارگذاری‌شده</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              className="pr-10"
              placeholder="نام یا موبایل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لیست</CardTitle>
          <CardDescription>
            {filtered.length} از {customers.length} مشتری
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-main-orange" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-10">
              مشتری اختصاص‌یافته‌ای یافت نشد
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نام</TableHead>
                    <TableHead>موبایل</TableHead>
                    <TableHead>ایمیل</TableHead>
                    <TableHead>عضویت</TableHead>
                    <TableHead>یادداشت</TableHead>
                    <TableHead>عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.phone}
                        </span>
                      </TableCell>
                      <TableCell>{c.email || '—'}</TableCell>
                      <TableCell>
                        {c.createdAt ? formatToJalali(c.createdAt) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate">
                        <span title={c.notes || undefined}>{c.notes || '—'}</span>
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(c)}
                        >
                          <Edit className="h-3.5 w-3.5 ml-1" />
                          ویرایش
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <div dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش مشتری</DialogTitle>
            <DialogDescription>فقط نام و شماره موبایل قابل ویرایش است</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="mc-name">نام</Label>
              <Input
                id="mc-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mc-phone">موبایل</Label>
              <Input
                id="mc-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                dir="ltr"
                inputMode="tel"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              انصراف
            </Button>
            <Button type="button" disabled={saving} onClick={handleSave}>
              {saving ? 'در حال ذخیره...' : 'ذخیره'}
            </Button>
          </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
