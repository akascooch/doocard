import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface TipTransaction {
  id: number;
  amount: number;
  date: string;
  barberId: number;
  type: 'deposit' | 'withdraw';
  status: 'pending' | 'approved' | 'rejected';
  barber?: { firstName: string; lastName: string };
}

interface Barber {
  id: number;
  firstName: string;
  lastName: string;
}

export function DailyTips() {
  const [tipSum, setTipSum] = useState<number>(0);
  const [transactions, setTransactions] = useState<TipTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [selectedBarberIds, setSelectedBarberIds] = useState<number[]>([]);
  const [divideAmount, setDivideAmount] = useState('');
  const [dividing, setDividing] = useState(false);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<TipTransaction[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);

  useEffect(() => {
    // TODO: Replace with real API call
    setLoading(true);
    fetch('/api/accounting/tips/daily')
      .then(res => res.json())
      .then(data => {
        setTipSum(data.sum || 0);
        setTransactions(data.transactions || []);
      })
      .finally(() => setLoading(false));
    // دریافت لیست باربرها برای تقسیم تیپ
    api.get('/barbers').then(res => setBarbers(res.data)).catch(() => setBarbers([]));
    // دریافت درخواست‌های برداشت در انتظار تأیید
    fetchPendingWithdrawals();
  }, []);

  const fetchPendingWithdrawals = async () => {
    setLoadingWithdrawals(true);
    try {
      const res = await fetch('/api/accounting/tips/withdrawals');
      const data = await res.json();
      setPendingWithdrawals(Array.isArray(data) ? data : []);
    } catch {
      setPendingWithdrawals([]);
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount || isNaN(Number(withdrawAmount)) || Number(withdrawAmount) <= 0) {
      toast.error('مبلغ معتبر وارد کنید');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/accounting/tips/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(withdrawAmount) }),
      });
      if (!res.ok) throw new Error('خطا در ثبت درخواست');
      toast.success('درخواست برداشت ثبت شد');
      setWithdrawAmount('');
      amountInputRef.current?.focus();
      // Refresh tips data
      setLoading(true);
      fetch('/api/accounting/tips/daily')
        .then(res => res.json())
        .then(data => {
          setTipSum(data.sum || 0);
          setTransactions(data.transactions || []);
        })
        .finally(() => setLoading(false));
    } catch (err) {
      toast.error('خطا در ثبت درخواست');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDivideTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divideAmount || isNaN(Number(divideAmount)) || Number(divideAmount) <= 0) {
      toast.error('مبلغ معتبر وارد کنید');
      return;
    }
    if (selectedBarberIds.length === 0) {
      toast.error('حداقل یک کارمند را انتخاب کنید');
      return;
    }
    setDividing(true);
    try {
      // فرض: API تقسیم تیپ را پیاده‌سازی می‌کنید
      await fetch('/api/accounting/tips/divide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(divideAmount),
          barberIds: selectedBarberIds,
        }),
      });
      toast.success('تیپ با موفقیت تقسیم شد');
      setDivideAmount('');
      setSelectedBarberIds([]);
      // Refresh tips data
      setLoading(true);
      fetch('/api/accounting/tips/daily')
        .then(res => res.json())
        .then(data => {
          setTipSum(data.sum || 0);
          setTransactions(data.transactions || []);
        })
        .finally(() => setLoading(false));
    } catch (err) {
      toast.error('خطا در تقسیم تیپ');
    } finally {
      setDividing(false);
    }
  };

  const handleApprove = async (id: number) => {
    await updateWithdrawalStatus(id, 'approved');
  };
  const handleReject = async (id: number) => {
    await updateWithdrawalStatus(id, 'rejected');
  };
  const updateWithdrawalStatus = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await fetch(`/api/accounting/tips/withdrawals/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast.success(`درخواست ${status === 'approved' ? 'تأیید' : 'رد'} شد`);
      fetchPendingWithdrawals();
      // Refresh tips data
      setLoading(true);
      fetch('/api/accounting/tips/daily')
        .then(res => res.json())
        .then(data => {
          setTipSum(data.sum || 0);
          setTransactions(data.transactions || []);
        })
        .finally(() => setLoading(false));
    } catch {
      toast.error('خطا در بروزرسانی وضعیت');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>مجموع تیپ روزانه</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? 'در حال بارگذاری...' : <span className="text-2xl font-bold">{tipSum.toLocaleString()} تومان</span>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>تراکنش‌های تیپ</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? '...' : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-right border">
                <thead>
                  <tr>
                    <th>مبلغ</th>
                    <th>تاریخ</th>
                    <th>نوع</th>
                    <th>وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tran => (
                    <tr key={tran.id}>
                      <td>{tran.amount.toLocaleString()} تومان</td>
                      <td>{new Date(tran.date).toLocaleDateString('fa-IR')}</td>
                      <td>{tran.type === 'deposit' ? 'واریز' : 'برداشت'}</td>
                      <td>{tran.status === 'approved' ? 'تأیید شده' : tran.status === 'pending' ? 'در انتظار' : 'رد شده'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>درخواست برداشت تیپ</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 max-w-xs" onSubmit={handleWithdraw}>
            <Input
              ref={amountInputRef}
              type="number"
              min={1}
              placeholder="مبلغ برداشت (تومان)"
              value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              disabled={submitting}
              required
            />
            <Button type="submit" disabled={submitting || !withdrawAmount}>
              {submitting ? 'در حال ارسال...' : 'ثبت درخواست برداشت'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>تقسیم تیپ بین کارمندان</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4 max-w-md" onSubmit={handleDivideTip}>
            <Input
              type="number"
              min={1}
              placeholder="مبلغ کل تیپ برای تقسیم (تومان)"
              value={divideAmount}
              onChange={e => setDivideAmount(e.target.value)}
              disabled={dividing}
              required
            />
            <div className="flex flex-wrap gap-2">
              {barbers.map(barber => (
                <label key={barber.id} className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedBarberIds.includes(barber.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedBarberIds(ids => [...ids, barber.id]);
                      } else {
                        setSelectedBarberIds(ids => ids.filter(id => id !== barber.id));
                      }
                    }}
                    disabled={dividing}
                  />
                  {barber.firstName} {barber.lastName}
                </label>
              ))}
            </div>
            <Button type="submit" disabled={dividing || !divideAmount || selectedBarberIds.length === 0}>
              {dividing ? 'در حال تقسیم...' : 'تقسیم تیپ'}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>درخواست‌های برداشت تیپ (در انتظار تأیید)</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingWithdrawals ? 'در حال بارگذاری...' : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>کارمند</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>تاریخ</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingWithdrawals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">درخواستی وجود ندارد</TableCell>
                  </TableRow>
                ) : pendingWithdrawals.map(req => (
                  <TableRow key={req.id}>
                    <TableCell>{req.barber ? req.barber.firstName + ' ' + req.barber.lastName : req.barberId}</TableCell>
                    <TableCell>{req.amount.toLocaleString()} تومان</TableCell>
                    <TableCell>{new Date(req.date).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="success" onClick={() => handleApprove(req.id)}>تأیید</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(req.id)} className="ml-2">رد</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 