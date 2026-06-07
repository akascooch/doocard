'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { ArrowRight, DollarSign, TrendingUp, TrendingDown, Calendar, Filter } from 'lucide-react';

interface Transaction {
  id: number;
  type: 'INCOME' | 'WITHDRAWAL' | 'TIP' | 'SALARY';
  amount: number;
  description: string;
  date: string;
  status?: string;
  reference?: string;
}

interface Barber {
  id: number;
  firstName: string;
  lastName: string;
}

interface BarberStats {
  totalIncome: number;
  totalWithdrawn: number;
  totalTips: number;
  totalSalaries: number;
  currentBalance: number;
}

export default function BarberTransactionDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const barberId = params.barberId as string;

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [barber, setBarber] = useState<Barber | null>(null);
  const [stats, setStats] = useState<BarberStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [withdrawalDialog, setWithdrawalDialog] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalDescription, setWithdrawalDescription] = useState('');

  const fetchData = async () => {
    if (!barberId) return;
    setLoading(true);
    try {
      const [transactionsRes, barberRes, statsRes] = await Promise.all([
        api.get(`/accounting/barbers/${barberId}/transactions`),
        api.get(`/barbers/${barberId}`),
        api.get(`/accounting/barbers/${barberId}/stats`),
      ]);
      setTransactions(transactionsRes.data);
      setBarber(barberRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('خطا در دریافت اطلاعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [barberId]);

  const handleWithdrawalRequest = async () => {
    if (!withdrawalAmount || Number(withdrawalAmount) <= 0) {
      toast.error('لطفاً مبلغ معتبر وارد کنید');
      return;
    }

    if (Number(withdrawalAmount) > (stats?.currentBalance || 0)) {
      toast.error('مبلغ درخواستی بیشتر از موجودی قابل برداشت است');
      return;
    }

    try {
      await api.post(`/accounting/barbers/${barberId}/withdrawal-request`, {
        amount: Number(withdrawalAmount),
        description: withdrawalDescription || 'درخواست برداشت از موجودی',
      });
      toast.success('درخواست برداشت با موفقیت ثبت شد');
      setWithdrawalDialog(false);
      setWithdrawalAmount('');
      setWithdrawalDescription('');
      fetchData();
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      toast.error('خطا در ثبت درخواست برداشت');
    }
  };

  const formatAmount = (amount: number) => new Intl.NumberFormat('fa-IR').format(amount);
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('fa-IR');

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOME': return { label: 'درآمد خدمات', color: 'bg-green-100 text-green-800' };
      case 'WITHDRAWAL': return { label: 'برداشت', color: 'bg-red-100 text-red-800' };
      case 'TIP': return { label: 'تیپ', color: 'bg-blue-100 text-blue-800' };
      case 'SALARY': return { label: 'حقوق', color: 'bg-purple-100 text-purple-800' };
      default: return { label: 'سایر', color: 'bg-gray-100 text-gray-800' };
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (filterType === 'all') return true;
    return transaction.type === filterType;
  });

  const tabFilteredTransactions = activeTab === 'all' 
    ? filteredTransactions 
    : filteredTransactions.filter(t => t.type === activeTab);

  if (loading) return <div className="p-8">در حال بارگذاری...</div>;

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowRight className="h-4 w-4" />
          </Button>
          <h2 className="text-2xl font-bold">
            جزئیات تراکنش‌ها: {barber ? `${barber.firstName} ${barber.lastName}` : ''}
          </h2>
        </div>
        <Button onClick={() => setWithdrawalDialog(true)}>
          <DollarSign className="h-4 w-4 ml-2" />
          درخواست برداشت
        </Button>
      </div>

      {/* آمار کلی */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">کل درآمد</p>
                  <p className="text-lg font-bold">{formatAmount(stats.totalIncome)} تومان</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">کل تیپ</p>
                  <p className="text-lg font-bold">{formatAmount(stats.totalTips)} تومان</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-gray-600">کل برداشت</p>
                  <p className="text-lg font-bold">{formatAmount(stats.totalWithdrawn)} تومان</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-600">کل حقوق</p>
                  <p className="text-lg font-bold">{formatAmount(stats.totalSalaries)} تومان</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm text-gray-600">موجودی فعلی</p>
                  <p className="text-lg font-bold">{formatAmount(stats.currentBalance)} تومان</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* فیلترها */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">فیلتر:</span>
            </div>
            <Select onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه تراکنش‌ها</SelectItem>
                <SelectItem value="INCOME">درآمد خدمات</SelectItem>
                <SelectItem value="TIP">تیپ</SelectItem>
                <SelectItem value="WITHDRAWAL">برداشت</SelectItem>
                <SelectItem value="SALARY">حقوق</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* تب‌های تراکنش‌ها */}
      <Card>
        <CardHeader>
          <CardTitle>تراکنش‌ها</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">همه</TabsTrigger>
              <TabsTrigger value="INCOME">درآمد</TabsTrigger>
              <TabsTrigger value="TIP">تیپ</TabsTrigger>
              <TabsTrigger value="WITHDRAWAL">برداشت</TabsTrigger>
              <TabsTrigger value="SALARY">حقوق</TabsTrigger>
            </TabsList>
            <TabsContent value={activeTab} className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نوع</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>تاریخ</TableHead>
                    <TableHead>توضیحات</TableHead>
                    <TableHead>وضعیت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tabFilteredTransactions.length > 0 ? (
                    tabFilteredTransactions.map((transaction) => {
                      const typeInfo = getTransactionTypeLabel(transaction.type);
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <Badge className={typeInfo.color}>
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className={`font-bold ${transaction.type === 'WITHDRAWAL' ? 'text-red-600' : 'text-green-600'}`}>
                            {transaction.type === 'WITHDRAWAL' ? '-' : '+'}{formatAmount(transaction.amount)} تومان
                          </TableCell>
                          <TableCell>{formatDate(transaction.date)}</TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>
                            {transaction.status && (
                              <Badge variant={transaction.status === 'COMPLETED' ? 'default' : 'secondary'}>
                                {transaction.status === 'COMPLETED' ? 'تکمیل شده' : 'در انتظار'}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        هیچ تراکنشی یافت نشد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dialog درخواست برداشت */}
      <Dialog open={withdrawalDialog} onOpenChange={setWithdrawalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>درخواست برداشت از موجودی</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="amount">مبلغ برداشت</Label>
              <Input
                id="amount"
                type="number"
                value={withdrawalAmount}
                onChange={(e: any) => setWithdrawalAmount(e.target.value)}
                placeholder="مبلغ را وارد کنید"
              />
              {stats && (
                <p className="text-sm text-gray-500 mt-1">
                  موجودی قابل برداشت: {formatAmount(stats.currentBalance)} تومان
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="description">توضیحات (اختیاری)</Label>
              <Input
                id="description"
                value={withdrawalDescription}
                onChange={(e: any) => setWithdrawalDescription(e.target.value)}
                placeholder="توضیحات درخواست"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setWithdrawalDialog(false)}>
                انصراف
              </Button>
              <Button onClick={handleWithdrawalRequest}>
                ثبت درخواست
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 