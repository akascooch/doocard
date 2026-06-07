'use client';

import { useState, useEffect } from 'react';
import { Loader2, DollarSign, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import MoneyInput from '@/components/ui/MoneyInput';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { toTomans } from '@/lib/money';

interface Service {
  serviceId: number;
  priceAtBooking: number;
  durationMin: number;
  serviceName?: string;
}

interface Appointment {
  id: number;
  services: Service[];
  amount?: number;
  status: string;
  customerName: string;
}

interface BankAccount {
  id: number;
  name: string;
  balance: number;
}

interface PaymentModalProps {
  appointmentId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PaymentModal({
  appointmentId,
  isOpen,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  const [formData, setFormData] = useState({
    amount: 0,
    tipAmount: 0,
    paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'CARD2CARD' | 'DEBT',
    accountId: null as number | null,
    notes: '',
  });

  useEffect(() => {
    if (isOpen && appointmentId) {
      loadData();
    }
  }, [isOpen, appointmentId]);

  const loadData = async () => {
    if (!appointmentId) return;

    try {
      setLoadingData(true);

      // Load appointment
      const apptResponse = await api.get(`/appointments/${appointmentId}`);
      const apptData = apptResponse.data;
      setAppointment(apptData);

      // Calculate total from services
      const calculatedAmount = apptData.services.reduce(
        (sum: number, s: Service) => sum + s.priceAtBooking,
        0
      );

      setFormData({
        ...formData,
        amount: calculatedAmount,
      });

      // Load bank accounts
      const accountsResponse = await api.get('/accounting/accounts');
      setAccounts(accountsResponse.data);

      // Set default account
      const defaultAccount = accountsResponse.data.find((a: BankAccount) => a.id === 1);
      if (defaultAccount) {
        setFormData(prev => ({ ...prev, accountId: defaultAccount.id }));
      }

      console.log('💰 Loaded appointment for settlement:', apptData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'خطا',
        description: 'بارگذاری اطلاعات با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoadingData(false);
    }
  };

  const generateIdempotencyKey = (): string => {
    return `settle_${appointmentId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointmentId || !appointment) return;

    if (formData.paymentMethod !== 'DEBT' && !formData.accountId) {
      toast({
        title: 'خطا',
        description: 'انتخاب حساب بانکی برای این روش پرداخت الزامی است',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        amount: formData.amount, // Already in RIAL
        tipAmount: formData.tipAmount || 0, // Already in RIAL
        paymentMethod: formData.paymentMethod,
        accountId: formData.paymentMethod === 'DEBT' ? undefined : formData.accountId,
        notes: formData.notes || undefined,
        externalRef: generateIdempotencyKey(),
      };

      console.log('💸 Settling appointment:', payload);

      await api.post(`/appointments/${appointmentId}/settle`, payload);

      toast({
        title: formData.paymentMethod === 'DEBT' ? '🧾 بدهی ثبت شد' : '💰 تسویه انجام شد',
        description:
          formData.paymentMethod === 'DEBT'
            ? 'مبلغ به عنوان بدهی مشتری ثبت شد'
            : 'نوبت با موفقیت تسویه و مبلغ دریافت شد',
      });

      onClose();
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error settling appointment:', error);
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'تسویه نوبت با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatedTotal = appointment
    ? appointment.services.reduce((sum, s) => sum + s.priceAtBooking, 0)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-main-orange" />
            تسویه نوبت
          </DialogTitle>
          <DialogDescription>
            {appointment && `مشتری: ${appointment.customerName}`}
          </DialogDescription>
        </DialogHeader>

        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-main-orange" />
          </div>
        ) : appointment ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Services Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-sm font-medium mb-2">سرویس‌های انجام شده:</p>
              <ul className="text-sm space-y-1">
                {appointment.services.map((service, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{service.serviceName || `سرویس ${idx + 1}`}</span>
                    <span className="text-main-orange font-medium">
                      {toTomans(service.priceAtBooking)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <span className="font-semibold">جمع کل:</span>
                <span className="font-bold text-main-orange">
                  {toTomans(calculatedTotal)}
                </span>
              </div>
            </div>

            {/* Amount Input - Editable */}
            <div className="space-y-2">
              <MoneyInput
                value={formData.amount}
                onChange={(amount) => setFormData({ ...formData, amount })}
                label="مبلغ نهایی *"
                placeholder="مثال: 500,000"
                required
              />
              <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1">
                💡 مبلغ قابل ویرایش است در صورت تغییر توافق با مشتری
              </p>
            </div>

            {/* Tip Amount */}
            <MoneyInput
              value={formData.tipAmount}
              onChange={(tipAmount) => setFormData({ ...formData, tipAmount })}
              label="انعام (اختیاری)"
              placeholder="مثال: 50,000"
            />

            {/* Payment Method */}
            <div>
              <Label>روش پرداخت *</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(val: any) =>
                  setFormData({ ...formData, paymentMethod: val })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">نقدی</SelectItem>
                  <SelectItem value="CARD">کارت خوان</SelectItem>
                  <SelectItem value="CARD2CARD">کارت به کارت</SelectItem>
                  <SelectItem value="DEBT">بدهی</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank Account (hidden for DEBT) */}
            {formData.paymentMethod !== 'DEBT' && (
              <div>
                <Label>حساب بانکی *</Label>
                <Select
                  value={formData.accountId?.toString() || ''}
                  onValueChange={(val) =>
                    setFormData({ ...formData, accountId: parseInt(val) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب حساب..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id.toString()}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* DEBT Alert */}
            {formData.paymentMethod === 'DEBT' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  این مبلغ به عنوان بدهی مشتری ثبت خواهد شد و در حسابداری نمایش داده می‌شود.
                </AlertDescription>
              </Alert>
            )}

            {/* Notes */}
            <div>
              <Label>یادداشت (اختیاری)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="توضیحات تسویه..."
                rows={2}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                انصراف
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-main-orange hover:bg-main-orange/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    در حال تسویه...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 ml-2" />
                    تسویه نوبت
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            اطلاعات نوبت یافت نشد
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

