'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calculator, 
  Edit, 
  Save, 
  Calendar,
  Filter,
  Download
} from 'lucide-react';

interface Barber {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  salaryPercentage: number;
  isActive: boolean;
  balance: number;
}

interface SalaryReport {
  barberId: number;
  barberName: string;
  salaryPercentage: number;
  totalIncome: number;
  totalTips: number;
  calculatedSalary: number;
  totalWithdrawn: number;
  currentBalance: number;
  salonShare: number;
}

interface SalaryCalculation {
  barberId: number;
  barberName: string;
  baseSalary: number;
  tipShare: number;
  bonus: number;
  deductions: number;
  totalSalary: number;
  salonShare: number;
}

export default function SalaryManagement() {
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [salaryReports, setSalaryReports] = useState<SalaryReport[]>([]);
  const [salaryCalculations, setSalaryCalculations] = useState<SalaryCalculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [editDialog, setEditDialog] = useState(false);
  const [editingBarber, setEditingBarber] = useState<Barber | null>(null);
  const [newPercentage, setNewPercentage] = useState('');
  const [filterActive, setFilterActive] = useState('all');

  // دریافت لیست آرایشگران
  const fetchBarbers = async () => {
    try {
      const response = await api.get('/barbers');
      setBarbers(response.data);
    } catch (error) {
      console.error('Error fetching barbers:', error);
      toast.error('خطا در دریافت لیست آرایشگران');
    }
  };

  // دریافت گزارش حقوق
  const fetchSalaryReports = async () => {
    try {
      const response = await api.get('/accounting/salary/reports', {
        params: { month: selectedMonth.toISOString() }
      });
      setSalaryReports(response.data);
    } catch (error) {
      console.error('Error fetching salary reports:', error);
      toast.error('خطا در دریافت گزارش حقوق');
    }
  };

  // محاسبه حقوق
  const calculateSalaries = async () => {
    try {
      const response = await api.get('/accounting/salary/calculate', {
        params: { month: selectedMonth.toISOString() }
      });
      setSalaryCalculations(response.data);
      toast.success('محاسبه حقوق با موفقیت انجام شد');
    } catch (error) {
      console.error('Error calculating salaries:', error);
      toast.error('خطا در محاسبه حقوق');
    }
  };

  // به‌روزرسانی درصد حقوق
  const updateSalaryPercentage = async () => {
    if (!editingBarber || !newPercentage) return;
    
    try {
      await api.put(`/accounting/salary/percentage/${editingBarber.id}`, {
        percentage: parseInt(newPercentage)
      });
      
      toast.success('درصد حقوق با موفقیت به‌روزرسانی شد');
      setEditDialog(false);
      setEditingBarber(null);
      setNewPercentage('');
      fetchBarbers();
      fetchSalaryReports();
    } catch (error) {
      console.error('Error updating salary percentage:', error);
      toast.error('خطا در به‌روزرسانی درصد حقوق');
    }
  };

  // شروع ویرایش
  const startEdit = (barber: Barber) => {
    setEditingBarber(barber);
    setNewPercentage(barber.salaryPercentage.toString());
    setEditDialog(true);
  };

  // فیلتر آرایشگران
  const filteredBarbers = barbers.filter(barber => {
    if (filterActive === 'all') return true;
    if (filterActive === 'active') return barber.isActive;
    if (filterActive === 'inactive') return !barber.isActive;
    return true;
  });

  useEffect(() => {
    fetchBarbers();
    fetchSalaryReports();
    setLoading(false);
  }, [selectedMonth]);

  const formatAmount = (amount: number) => new Intl.NumberFormat('fa-IR').format(amount);
  const formatPercentage = (percentage: number) => `${percentage}%`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* هدر و کنترل‌ها */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">مدیریت حقوق آرایشگران</h2>
          <p className="text-muted-foreground">مدیریت درصد حقوق و محاسبه حقوق ماهانه</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <Input
              type="month"
              value={`${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`}
              onChange={(e) => {
                const [year, month] = e.target.value.split('-');
                setSelectedMonth(new Date(parseInt(year), parseInt(month) - 1));
              }}
            />
          </div>
          <Button onClick={calculateSalaries}>
            <Calculator className="h-4 w-4 ml-2" />
            محاسبه حقوق
          </Button>
        </div>
      </div>

      {/* آمار کلی */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">کل آرایشگران</p>
                <p className="text-lg font-bold">{barbers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">آرایشگران فعال</p>
                <p className="text-lg font-bold">{barbers.filter(b => b.isActive).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">متوسط درصد حقوق</p>
                <p className="text-lg font-bold">
                  {barbers.length > 0 
                    ? formatPercentage(Math.round(barbers.reduce((sum, b) => sum + b.salaryPercentage, 0) / barbers.length))
                    : '0%'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">کل موجودی</p>
                <p className="text-lg font-bold">
                  {formatAmount(barbers.reduce((sum, b) => sum + b.balance, 0))} تومان
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* تب‌های اصلی */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="salary-percentages">درصدهای حقوق</TabsTrigger>
          <TabsTrigger value="salary-reports">گزارش حقوق</TabsTrigger>
          <TabsTrigger value="salary-calculations">محاسبات حقوق</TabsTrigger>
        </TabsList>

        {/* نمای کلی */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>خلاصه وضعیت حقوق آرایشگران</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Filter className="h-4 w-4" />
                  <Select onValueChange={setFilterActive}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder={filterActive === 'all' ? 'همه آرایشگران' : filterActive === 'active' ? 'فقط فعال' : 'غیرفعال'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">همه آرایشگران</SelectItem>
                      <SelectItem value="active">فقط فعال</SelectItem>
                      <SelectItem value="inactive">غیرفعال</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>نام آرایشگر</TableHead>
                      <TableHead>درصد حقوق</TableHead>
                      <TableHead>موجودی فعلی</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>عملیات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBarbers.map((barber) => (
                      <TableRow key={barber.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{barber.firstName} {barber.lastName}</p>
                            <p className="text-sm text-muted-foreground">{barber.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-bold">
                            {formatPercentage(barber.salaryPercentage)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatAmount(barber.balance)} تومان
                        </TableCell>
                        <TableCell>
                          <Badge variant={barber.isActive ? "default" : "secondary"}>
                            {barber.isActive ? 'فعال' : 'غیرفعال'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(barber)}
                          >
                            <Edit className="h-4 w-4 ml-1" />
                            ویرایش
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* درصدهای حقوق */}
        <TabsContent value="salary-percentages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>مدیریت درصدهای حقوق</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredBarbers.map((barber) => (
                  <Card key={barber.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-medium">{barber.firstName} {barber.lastName}</h4>
                        <p className="text-sm text-muted-foreground">{barber.email}</p>
                      </div>
                      <Badge variant="outline" className="font-bold">
                        {formatPercentage(barber.salaryPercentage)}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        موجودی: {formatAmount(barber.balance)} تومان
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => startEdit(barber)}
                      >
                        <Edit className="h-4 w-4 ml-1" />
                        تغییر درصد
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* گزارش حقوق */}
        <TabsContent value="salary-reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>گزارش حقوق ماهانه</CardTitle>
            </CardHeader>
            <CardContent>
              {salaryReports.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>نام آرایشگر</TableHead>
                      <TableHead>درصد حقوق</TableHead>
                      <TableHead>کل درآمد</TableHead>
                      <TableHead>کل تیپ</TableHead>
                      <TableHead>حقوق محاسبه شده</TableHead>
                      <TableHead>سهم آرایشگاه</TableHead>
                      <TableHead>موجودی فعلی</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryReports.map((report) => (
                      <TableRow key={report.barberId}>
                        <TableCell className="font-medium">{report.barberName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatPercentage(report.salaryPercentage)}</Badge>
                        </TableCell>
                        <TableCell>{formatAmount(report.totalIncome)} تومان</TableCell>
                        <TableCell>{formatAmount(report.totalTips)} تومان</TableCell>
                        <TableCell className="font-bold text-green-600">
                          {formatAmount(report.calculatedSalary)} تومان
                        </TableCell>
                        <TableCell className="text-blue-600">
                          {formatAmount(report.salonShare)} تومان
                        </TableCell>
                        <TableCell className="font-bold">
                          {formatAmount(report.currentBalance)} تومان
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>هیچ گزارش حقوقی برای این ماه یافت نشد</p>
                  <Button onClick={fetchSalaryReports} className="mt-2">
                    بارگذاری مجدد
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* محاسبات حقوق */}
        <TabsContent value="salary-calculations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>محاسبات تفصیلی حقوق</CardTitle>
            </CardHeader>
            <CardContent>
              {salaryCalculations.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>نام آرایشگر</TableHead>
                      <TableHead>حقوق پایه</TableHead>
                      <TableHead>سهم تیپ</TableHead>
                      <TableHead>پاداش</TableHead>
                      <TableHead>کسورات</TableHead>
                      <TableHead>کل حقوق</TableHead>
                      <TableHead>سهم آرایشگاه</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryCalculations.map((calc) => (
                      <TableRow key={calc.barberId}>
                        <TableCell className="font-medium">{calc.barberName}</TableCell>
                        <TableCell>{formatAmount(calc.baseSalary)} تومان</TableCell>
                        <TableCell>{formatAmount(calc.tipShare)} تومان</TableCell>
                        <TableCell>{formatAmount(calc.bonus)} تومان</TableCell>
                        <TableCell className="text-red-600">
                          {formatAmount(calc.deductions)} تومان
                        </TableCell>
                        <TableCell className="font-bold text-green-600">
                          {formatAmount(calc.totalSalary)} تومان
                        </TableCell>
                        <TableCell className="text-blue-600">
                          {formatAmount(calc.salonShare)} تومان
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>هیچ محاسبه حقوقی انجام نشده است</p>
                  <Button onClick={calculateSalaries} className="mt-2">
                    <Calculator className="h-4 w-4 ml-2" />
                    محاسبه حقوق
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog ویرایش درصد حقوق */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تغییر درصد حقوق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {editingBarber && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  آرایشگر: <span className="font-medium">{editingBarber.firstName} {editingBarber.lastName}</span>
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  درصد فعلی: <span className="font-bold">{formatPercentage(editingBarber.salaryPercentage)}</span>
                </p>
                <div>
                  <Label htmlFor="percentage">درصد جدید حقوق</Label>
                  <Input
                    id="percentage"
                    type="number"
                    min="1"
                    max="100"
                    value={newPercentage}
                    onChange={(e) => setNewPercentage(e.target.value)}
                    placeholder="درصد جدید را وارد کنید"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    درصد باید بین 1 تا 100 باشد
                  </p>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditDialog(false)}>
                انصراف
              </Button>
              <Button onClick={updateSalaryPercentage} disabled={!newPercentage}>
                <Save className="h-4 w-4 ml-2" />
                ذخیره تغییرات
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
