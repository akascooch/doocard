'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/axios';
import { Loader2, UserPlus } from 'lucide-react';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** Canonical Iranian mobile 09xxxxxxxxx for display/submit */
export function normalizeIranMobileClient(raw: string): string {
  let p = String(raw || '')
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[\s\-()]/g, '')
    .trim();

  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);

  return p;
}

const IRAN_MOBILE_RE = /^09\d{9}$/;
const NAME_MAX = 100;

export function QuickRegisterCustomerForm() {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const validate = (): boolean => {
    let ok = true;
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('نام الزامی است');
      ok = false;
    } else if (trimmedName.length > NAME_MAX) {
      setNameError('نام نباید بیش از ۱۰۰ کاراکتر باشد');
      ok = false;
    } else {
      setNameError('');
    }

    const normalized = normalizeIranMobileClient(phone);
    if (!IRAN_MOBILE_RE.test(normalized)) {
      setPhoneError('شماره موبایل معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹)');
      ok = false;
    } else {
      setPhoneError('');
    }
    return ok;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    const normalizedPhone = normalizeIranMobileClient(phone);
    const trimmedName = name.trim();

    setSubmitting(true);
    try {
      await api.post('/customers/quick', {
        name: trimmedName,
        phone: normalizedPhone,
      });
      toast({
        title: 'موفق',
        description: 'مشتری با موفقیت ثبت شد',
      });
      setName('');
      setPhone('');
      setNameError('');
      setPhoneError('');
    } catch (error: any) {
      const status = error?.response?.status;
      const message =
        error?.response?.data?.message ||
        (Array.isArray(error?.response?.data?.message)
          ? error.response.data.message.join('، ')
          : null);

      if (status === 409) {
        toast({
          title: 'تداخل',
          description: message || 'این شماره متعلق به کاربر با نقش دیگر است یا قبلاً ثبت شده',
          variant: 'destructive',
        });
      } else if (status === 400) {
        toast({
          title: 'خطا در اعتبارسنجی',
          description: message || 'اطلاعات وارد شده نامعتبر است',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'خطا',
          description: message || 'ثبت مشتری با خطا مواجه شد',
          variant: 'destructive',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-md" noValidate>
      <div className="space-y-2">
        <Label htmlFor="qc-name">نام مشتری</Label>
        <Input
          id="qc-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام و نام خانوادگی"
          maxLength={NAME_MAX}
          disabled={submitting}
          className="min-h-11"
          autoComplete="name"
        />
        {nameError && <p className="text-sm text-destructive">{nameError}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="qc-phone">شماره موبایل</Label>
        <Input
          id="qc-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => {
            const n = normalizeIranMobileClient(phone);
            if (n) setPhone(n);
          }}
          placeholder="۰۹۱۲۳۴۵۶۷۸۹"
          inputMode="tel"
          disabled={submitting}
          className="min-h-11 font-mono tracking-wide"
          dir="ltr"
          autoComplete="tel"
        />
        {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
      </div>

      <Button type="submit" disabled={submitting} className="w-full min-h-11">
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            در حال ثبت...
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4 ml-2" />
            ثبت مشتری
          </>
        )}
      </Button>
    </form>
  );
}
