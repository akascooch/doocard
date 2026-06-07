'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import api from '../../lib/axios';
import { DollarSign, CheckCircle, XCircle, Hourglass, Banknote, Edit, Trash2, Info } from 'lucide-react';
import Link from 'next/link';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { getCurrentUser } from '../../lib/auth';

interface BarberBalance {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  totalIncome: number;
  totalWithdrawals: number;
  balance: number;
  serviceAmount: number; // مبلغ خدمات
  tipAmount: number;     // مبلغ تیپ
  salaryAmount: number;  // مبلغ حقوق
}

interface WithdrawalRequest {
  id: number;
  barberId: number;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  barber: {
    firstName: string;
    lastName: string;
  };
}

interface BankAccount {
  id: number;
  name: string;
  cardNumber: string;
}

export function BarberBalances() {
  const [balances, setBalances] = useState<BarberBalance[]>([]);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [salonPercentage, setSalonPercentage] = useState(40);
  const [showSalaryDialog, setShowSalaryDialog] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<BarberBalance | null>(null);
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryStartDate, setSalaryStartDate] = useState('');
  const [salaryEndDate, setSalaryEndDate] = useState('');
  const [salaryDescription, setSalaryDescription] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching barber balances data...');
      
      const [balancesRes, requestsRes, accountsRes] = await Promise.all([
        api.get('/accounting/barbers/balances'),
        api.get('/accounting/barbers/withdrawals?status=PENDING'),
        api.get('/accounting/bank-accounts'),
      ]);
      
      console.log('📊 Balances response:', balancesRes.data);
      console.log('📊 Requests response:', requestsRes.data);
      console.log('📊 Bank accounts response:', accountsRes.data);
      
      setBalances(balancesRes.data);
      setRequests(requestsRes.data);
      setBankAccounts(accountsRes.data);
    } catch (error: any) {
      console.error('❌ Error fetching data:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error('خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async () => {
    if (!selectedRequest || !selectedAccountId) {
      toast.error('لطفاً حساب بانکی را انتخاب کنید');
      return;
    }
    
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
      toast.error('خطا در شناسایی کاربر');
      return;
    }
    
    try {
      console.log('🔍 Approving withdrawal request:', {
        requestId: selectedRequest.id,
        bankAccountId: selectedAccountId,
        salonPercentage: salonPercentage,
        adminId: currentUser.id,
      });
      
      const response = await api.post(`/accounting/barbers/withdrawals/${selectedRequest.id}/approve`, {
        adminId: currentUser.id,
        bankAccountId: Number(selectedAccountId),
        salonPercentage: salonPercentage,
      });
      
      console.log('✅ Approval response:', response.data);
      toast.success('درخواست برداشت با موفقیت تایید شد');
      setSelectedRequest(null);
      setSelectedAccountId('');
      setSalonPercentage(40);
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('❌ Error approving request:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error('خطا در تایید درخواست');
    }
  };

  const handleReject = async (requestId: number) => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
      toast.error('خطا در شناسایی کاربر');
      return;
    }
    
    try {
      console.log('🔍 Rejecting withdrawal request:', {
        requestId,
        adminId: currentUser.id,
      });
      
      const response = await api.post(`/accounting/barbers/withdrawals/${requestId}/reject`, {
        adminId: currentUser.id,
      });
      
      console.log('✅ Reject response:', response.data);
      toast.success('درخواست برداشت رد شد');
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('❌ Error rejecting request:', error);
      console.error('❌ Error response:', error.response?.data);
      toast.error('خطا در رد درخواست');
    }
  };

  const handleWithdrawalRequest = async (barberId: number, amount: number) => {
    try {
      await api.post(`/accounting/barbers/${barberId}/withdrawal-request`, {
        amount,
        description: 'درخواست برداشت از موجودی'
      });
      toast.success('درخواست برداشت با موفقیت ثبت شد');
      fetchData(); // Refresh data
    } catch (error: any) {
      console.error('Error submitting withdrawal request:', error);
      toast.error('خطا در ثبت درخواست برداشت');
    }
  };

  const handleCreateSalary = async () => {
    if (!selectedBarber || !salaryAmount || !salaryStartDate || !salaryEndDate) {
      toast.error('لطفاً تمام فیلدها را پر کنید');
      return;
    }

    try {
      const response = await api.post('/accounting/salaries/regular', {
        barberId: selectedBarber.id,
        amount: Number(salaryAmount),
        startDate: salaryStartDate,
        endDate: salaryEndDate,
        description: salaryDescription,
      });

      toast.success('حقوق با موفقیت ایجاد شد');
      setShowSalaryDialog(false);
      setSelectedBarber(null);
      setSalaryAmount('');
      setSalaryStartDate('');
      setSalaryEndDate('');
      setSalaryDescription('');
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error creating salary:', error);
      toast.error('خطا در ایجاد حقوق');
    }
  };

  const formatAmount = (amount: number) => new Intl.NumberFormat('fa-IR').format(amount);

  if (loading) {
    return <div className="text-center p-8">در حال بارگذاری...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">موجودی آرایشگران</h2>
        <div className="flex gap-2">
          <Button onClick={() => setShowSalaryDialog(true)}>
            ایجاد حقوق جدید
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hourglass className="h-5 w-5" />
            درخواست‌های برداشت در انتظار
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام آرایشگر</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>تاریخ درخواست</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{req.barber.firstName} {req.barber.lastName}</TableCell>
                    <TableCell>{formatAmount(req.amount)} تومان</TableCell>
                    <TableCell>{new Date(req.createdAt).toLocaleDateString('fa-IR')}</TableCell>
                    <TableCell className="flex gap-2">
                      <Dialog open={selectedRequest?.id === req.id} onOpenChange={(isOpen) => !isOpen && setSelectedRequest(null)}>
                        <DialogTrigger asChild>
                          <Button size="sm" onClick={() => setSelectedRequest(req)}>
                            <CheckCircle className="h-4 w-4 ml-1" />
                            تایید
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>تایید برداشت و انتخاب حساب</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <p>مبلغ <span className="font-bold">{formatAmount(req.amount)} تومان</span> برای <span className="font-bold">{req.barber.firstName} {req.barber.lastName}</span></p>
                            
                            <div>
                              <Label>درصد سهم آرایشگاه</Label>
                              <div className="flex items-center gap-2 mt-1">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={salonPercentage}
                                  onChange={(e) => setSalonPercentage(Number(e.target.value))}
                                  className="w-20"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                سهم آرایشگر: {100 - salonPercentage}% = {formatAmount(Math.round(req.amount * (100 - salonPercentage) / 100))} تومان
                              </p>
                            </div>
                            
                            <Select onValueChange={setSelectedAccountId}>
                              <SelectTrigger>
                                <SelectValue placeholder="انتخاب حساب بانکی برای پرداخت" />
                              </SelectTrigger>
                              <SelectContent>
                                {bankAccounts.map(acc => (
                                  <SelectItem key={acc.id} value={String(acc.id)}>
                                    {acc.name} - ({acc.cardNumber})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" onClick={() => setSelectedRequest(null)}>انصراف</Button>
                              <Button onClick={handleApprove} disabled={!selectedAccountId}>تایید و پرداخت</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button size="sm" variant="outline" onClick={() => handleReject(req.id)}>
                        <XCircle className="h-4 w-4 ml-1" />
                        رد
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground p-4">هیچ درخواست برداشت در انتظاری وجود ندارد.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            موجودی آرایشگران
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نام</TableHead>
                <TableHead>ایمیل</TableHead>
                <TableHead>مبلغ خدمات</TableHead>
                <TableHead>مبلغ تیپ</TableHead>
                <TableHead>مبلغ حقوق</TableHead>
                <TableHead>کل درآمد</TableHead>
                <TableHead>برداشت‌ها</TableHead>
                <TableHead>موجودی فعلی</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((barber) => (
                <TableRow key={barber.id}>
                  <TableCell>
                    {barber.firstName} {barber.lastName}
                  </TableCell>
                  <TableCell>{barber.email}</TableCell>
                  <TableCell className="text-green-600">
                    {formatAmount(barber.serviceAmount || 0)}
                  </TableCell>
                  <TableCell className="text-blue-600">
                    {formatAmount(barber.tipAmount || 0)}
                  </TableCell>
                  <TableCell className="text-purple-600">
                    {formatAmount(barber.salaryAmount || 0)}
                  </TableCell>
                  <TableCell className="font-bold">
                    {formatAmount(barber.totalIncome)}
                  </TableCell>
                  <TableCell className="text-red-600">
                    {formatAmount(barber.totalWithdrawals)}
                  </TableCell>
                  <TableCell className="font-bold text-lg">
                    {formatAmount(barber.balance)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBarber(barber);
                          setShowSalaryDialog(true);
                        }}
                      >
                        ایجاد حقوق
                      </Button>
                      <Link href={`/dashboard/accounting/salaries/${barber.id}`}>
                        <Button size="sm" variant="outline">
                          مشاهده حقوق
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Salary Creation Dialog */}
      <Dialog open={showSalaryDialog} onOpenChange={setShowSalaryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ایجاد حقوق جدید</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBarber && (
              <div className="p-3 bg-gray-50 rounded">
                <p className="font-medium">آرایشگر: {selectedBarber.firstName} {selectedBarber.lastName}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>مبلغ حقوق</Label>
                <Input
                  type="number"
                  value={salaryAmount}
                  onChange={(e) => setSalaryAmount(e.target.value)}
                  placeholder="مبلغ حقوق"
                />
              </div>
              <div>
                <Label>تاریخ شروع</Label>
                <Input
                  type="date"
                  value={salaryStartDate}
                  onChange={(e) => setSalaryStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>تاریخ پایان</Label>
                <Input
                  type="date"
                  value={salaryEndDate}
                  onChange={(e) => setSalaryEndDate(e.target.value)}
                />
              </div>
              <div>
                <Label>توضیحات (اختیاری)</Label>
                <Input
                  value={salaryDescription}
                  onChange={(e) => setSalaryDescription(e.target.value)}
                  placeholder="توضیحات"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSalaryDialog(false)}>
                لغو
              </Button>
              <Button onClick={handleCreateSalary}>
                ایجاد حقوق
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 