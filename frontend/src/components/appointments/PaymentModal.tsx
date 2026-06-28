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
import { getAppointmentServices, isTipRecipientType, type AppointmentRecord } from '@/lib/appointment';
import { TIP_SPLIT_LABEL_INDIVIDUAL, TIP_SPLIT_LABEL_TEAM } from '@/lib/tip-distribution';
import { shouldUseOfflineQueue, queueAppointmentSettle } from '@/lib/offline/sync-worker';
import { isOfflineModeEnabled } from '@/lib/offline/feature-flag';
import { cacheFromResponse, getReferenceCache, REFERENCE_KEYS } from '@/lib/offline/reference-cache';
import { checkServerReachability } from '@/lib/offline/connectivity';

const BARBER_APPOINTMENT_DEDUCTION_TOMAN = 200000;

interface Service {
  serviceId: number;
  priceAtBooking: number;
  durationMin: number;
  serviceName?: string;
}

interface Appointment {
  id: number;
  services: Service[];
  amount?: number | null;
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
  prefetchedAppointment?: AppointmentRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PaymentModal({
  appointmentId,
  prefetchedAppointment,
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
    tipRecipientType: '' as '' | 'INDIVIDUAL' | 'TEAM',
    tipRecipientEmployeeId: null as number | null,
    paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'CARD2CARD' | 'DEBT',
    accountId: null as number | null,
    notes: '',
  });
  const [serviceStaff, setServiceStaff] = useState<{ id: number; name: string }[]>([]);
  const [settleExternalRef, setSettleExternalRef] = useState<string | null>(null);
  const [serverOffline, setServerOffline] = useState(false);

  useEffect(() => {
    if (isOpen && appointmentId) {
      setSettleExternalRef(`settle_${appointmentId}_${crypto.randomUUID()}`);
    }
  }, [isOpen, appointmentId]);

  useEffect(() => {
    if (isOpen && appointmentId) {
      loadData();
    }
  }, [isOpen, appointmentId]);

  const loadData = async () => {
    if (!appointmentId) return;

    try {
      setLoadingData(true);
      const reachable = await checkServerReachability();
      setServerOffline(!reachable);

      let apptData: Appointment | null = null;

      if (reachable) {
        const apptResponse = await api.get(`/appointments/${appointmentId}`);
        apptData = apptResponse.data;
      } else if (prefetchedAppointment && prefetchedAppointment.id === appointmentId) {
        apptData = prefetchedAppointment;
      }

      if (!apptData) {
        toast({
          title: 'خطا',
          description: 'برای تسویه آفلاین، ابتدا باید لیست نوبت‌ها در حالت آنلاین بارگذاری شده باشد.',
          variant: 'destructive',
        });
        return;
      }

      setAppointment(apptData);

      // Calculate total from services (nullable-safe for legacy rows)
      const calculatedAmount = getAppointmentServices(apptData).reduce(
        (sum, s) => sum + (s.priceAtBooking || 0),
        0,
      );

      setFormData({
        amount: calculatedAmount,
        tipAmount: 0,
        tipRecipientType: '',
        tipRecipientEmployeeId: null,
        paymentMethod: 'CASH',
        accountId: null,
        notes: '',
      });

      // Load bank accounts
      if (reachable) {
        const [accountsResponse, staffResponse] = await Promise.all([
          api.get('/accounting/accounts'),
          api.get('/employees/service-staff/active').catch(() => ({ data: [] })),
        ]);
        await cacheFromResponse(REFERENCE_KEYS.accounts, accountsResponse.data);
        setAccounts(accountsResponse.data);
        setServiceStaff(staffResponse.data || []);

        const defaultAccount = accountsResponse.data.find((a: BankAccount) => a.id === 1);
        if (defaultAccount) {
          setFormData((prev) => ({ ...prev, accountId: defaultAccount.id }));
        }
      } else {
        const cachedAccounts = await getReferenceCache<BankAccount[]>(REFERENCE_KEYS.accounts);
        if (cachedAccounts?.data?.length) {
          setAccounts(cachedAccounts.data);
          const defaultAccount = cachedAccounts.data.find((a) => a.id === 1);
          if (defaultAccount) {
            setFormData((prev) => ({ ...prev, accountId: defaultAccount.id }));
          }
        }
        setServiceStaff([]);
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

    const useOffline = await shouldUseOfflineQueue();

    if (useOffline) {
      if (formData.paymentMethod !== 'CASH') {
        toast({
          title: 'غیرفعال در حالت آفلاین',
          description: 'در حالت آفلاین فقط تسویه نقدی امکان‌پذیر است.',
          variant: 'destructive',
        });
        return;
      }
      if (formData.tipAmount > 0) {
        toast({
          title: 'غیرفعال در حالت آفلاین',
          description: 'ثبت انعام (فردی یا تیمی) در حالت آفلاین امکان‌پذیر نیست.',
          variant: 'destructive',
        });
        return;
      }
      if (!formData.accountId) {
        toast({
          title: 'خطا',
          description: 'حساب بانکی از حافظه آفلاین یافت نشد. ابتدا یک بار در حالت آنلاین وارد شوید.',
          variant: 'destructive',
        });
        return;
      }
      if (!settleExternalRef) {
        toast({
          title: 'خطا',
          description: 'خطای داخلی: کلید همگام‌سازی تسویه یافت نشد',
          variant: 'destructive',
        });
        return;
      }

      try {
        setLoading(true);
        await queueAppointmentSettle({
          externalRef: settleExternalRef,
          appointmentRef: { kind: 'server', appointmentId },
          amount: formData.amount,
          paymentMethod: 'CASH',
          accountId: formData.accountId,
          notes: formData.notes || undefined,
        });

        toast({
          title: 'تسویه آفلاین',
          description:
            'تسویه به صورت آفلاین ثبت شد و پس از اتصال به سرور همگام‌سازی می‌شود.',
        });
        onClose();
        if (onSuccess) onSuccess();
      } catch (error) {
        console.error('Error queueing offline settlement:', error);
        toast({
          title: 'خطا',
          description: 'ثبت آفلاین تسویه با خطا مواجه شد',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (formData.paymentMethod !== 'DEBT' && !formData.accountId) {
      toast({
        title: 'خطا',
        description: 'انتخاب حساب بانکی برای این روش پرداخت الزامی است',
        variant: 'destructive',
      });
      return;
    }

    if (formData.tipAmount > 0) {
      if (!formData.tipRecipientType) {
        toast({
          title: 'خطا',
          description: 'نوع گیرنده انعام را انتخاب کنید',
          variant: 'destructive',
        });
        return;
      }
      if (
        formData.tipRecipientType === 'INDIVIDUAL' &&
        !formData.tipRecipientEmployeeId
      ) {
        toast({
          title: 'خطا',
          description: 'پرسنل خدمات گیرنده انعام را انتخاب کنید',
          variant: 'destructive',
        });
        return;
      }
      if (formData.tipRecipientType === 'TEAM' && serviceStaff.length === 0) {
        toast({
          title: 'خطا',
          description: 'هیچ پرسنل خدمات فعالی برای انعام تیمی وجود ندارد',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setLoading(true);

      const payload: Record<string, unknown> = {
        amount: formData.amount, // Already in RIAL
        tipAmount: formData.tipAmount || 0, // Already in RIAL
        paymentMethod: formData.paymentMethod,
        accountId: formData.paymentMethod === 'DEBT' ? undefined : formData.accountId,
        notes: formData.notes || undefined,
        externalRef: generateIdempotencyKey(),
      };

      if (formData.tipAmount > 0) {
        payload.tipRecipientType = formData.tipRecipientType;
        if (formData.tipRecipientType === 'INDIVIDUAL') {
          payload.tipRecipientEmployeeId = formData.tipRecipientEmployeeId;
        }
      }

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
    ? getAppointmentServices(appointment).reduce(
        (sum, s) => sum + (s.priceAtBooking || 0),
        0,
      )
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
            {serverOffline && isOfflineModeEnabled() && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  حالت آفلاین: فقط تسویه نقدی بدون انعام امکان‌پذیر است.
                </AlertDescription>
              </Alert>
            )}
            {/* Services Summary */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-sm font-medium mb-2">سرویس‌های انجام شده:</p>
              <ul className="text-sm space-y-1">
                {getAppointmentServices(appointment).map((service, idx) => (
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

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">خلاصه سهم آرایشگر (برای تسویه حقوق)</p>
              <p>کسورات ثابت هر نوبت: {toTomans(BARBER_APPOINTMENT_DEDUCTION_TOMAN * 10)}</p>
              <p className="text-muted-foreground mt-1">
                این کسر فقط روی سهم پرداختی آرایشگر اعمال می‌شود و مبلغ پرداختی مشتری/درآمد نوبت را کم نمی‌کند.
              </p>
            </div>

            {/* Tip Amount */}
            <MoneyInput
              value={formData.tipAmount}
              onChange={(tipAmount) =>
                setFormData({
                  ...formData,
                  tipAmount,
                  tipRecipientType: tipAmount > 0 ? formData.tipRecipientType : '',
                  tipRecipientEmployeeId:
                    tipAmount > 0 ? formData.tipRecipientEmployeeId : null,
                })
              }
              label="انعام (اختیاری)"
              placeholder="مثال: 50,000"
            />

            {formData.tipAmount > 0 && (
              <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <div>
                  <Label>نوع گیرنده انعام *</Label>
                  <Select
                    value={formData.tipRecipientType}
                    onValueChange={(value: string) => {
                      if (!isTipRecipientType(value)) return;
                      setFormData({
                        ...formData,
                        tipRecipientType: value,
                        tipRecipientEmployeeId:
                          value === 'TEAM' ? null : formData.tipRecipientEmployeeId,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="انتخاب نوع..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">{TIP_SPLIT_LABEL_INDIVIDUAL}</SelectItem>
                      <SelectItem value="TEAM">{TIP_SPLIT_LABEL_TEAM}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipRecipientType === 'INDIVIDUAL' && (
                  <div>
                    <Label>پرسنل خدمات گیرنده *</Label>
                    <Select
                      value={formData.tipRecipientEmployeeId?.toString() || ''}
                      onValueChange={(val) =>
                        setFormData({
                          ...formData,
                          tipRecipientEmployeeId: parseInt(val, 10),
                        })
                      }
                      disabled={serviceStaff.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            serviceStaff.length === 0
                              ? 'پرسنل خدمات فعالی یافت نشد'
                              : 'انتخاب پرسنل خدمات...'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceStaff.map((staff) => (
                          <SelectItem key={staff.id} value={staff.id.toString()}>
                            {staff.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      آرایشگرها قابل انتخاب نیستند — فقط پرسنل خدمات
                    </p>
                  </div>
                )}

                {formData.tipRecipientType === 'TEAM' && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    سهم پرسنل ({serviceStaff.length} نفر فعال) به‌صورت مساوی بین پرسنل خدمات تقسیم می‌شود.
                  </p>
                )}
              </div>
            )}

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

