'use client';

import { useState, useEffect } from 'react';
import { Loader2, DollarSign, AlertCircle, Package, Plus, Trash2, ChevronDown } from 'lucide-react';
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
import { formatTomansFromRial, toTomans } from '@/lib/money';
import { formatToJalali } from '@/lib/date';
import { getAppointmentServices, isTipRecipientType, type AppointmentRecord } from '@/lib/appointment';
import { TIP_SPLIT_LABEL_INDIVIDUAL, TIP_SPLIT_LABEL_TEAM } from '@/lib/tip-distribution';
import { shouldUseOfflineQueue, queueAppointmentSettle } from '@/lib/offline/sync-worker';
import { isOfflineModeEnabled } from '@/lib/offline/feature-flag';
import { cacheFromResponse, getReferenceCache, REFERENCE_KEYS } from '@/lib/offline/reference-cache';
import { checkServerReachability } from '@/lib/offline/connectivity';

/** Barber-only tax per appointment (تومان). Salon tax is not deducted from barber payroll. */
const BARBER_APPOINTMENT_DEDUCTION_TOMAN = 80000;

interface Service {
  serviceId: number;
  priceAtBooking: number;
  durationMin: number;
  serviceName?: string;
}

interface Appointment {
  id: number;
  customerId?: number;
  services: Service[];
  amount?: number | null;
  status: string;
  customerName: string;
}

interface OpenDebtItem {
  id: number;
  amountRial: string;
  description: string | null;
  createdAt: string;
  appointmentId: number | null;
  appointmentScheduledAt: string | null;
}

interface OpenDebtsSummary {
  customerId: number;
  totalOpenRial: string;
  count: number;
  debts: OpenDebtItem[];
}

interface BankAccount {
  id: number;
  name: string;
  balance: number;
}

interface CatalogProduct {
  id: number;
  name: string;
  sku: string | null;
  priceRial: string;
  stock: number;
  isActive: boolean;
}

interface StoreLine {
  productId: number;
  name: string;
  quantity: number;
  unitPriceRial: string;
  stock: number;
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
  const [openDebts, setOpenDebts] = useState<OpenDebtsSummary | null>(null);

  const [formData, setFormData] = useState({
    amount: 0,
    paidAmount: 0,
    debtAmount: 0,
    tipAmount: 0,
    tipRecipientType: '' as '' | 'INDIVIDUAL' | 'TEAM',
    tipRecipientEmployeeId: null as number | null,
    tipTeamMemberIds: [] as number[],
    paymentMethod: 'CASH' as 'CASH' | 'CARD' | 'CARD2CARD' | 'DEBT',
    accountId: null as number | null,
    notes: '',
  });
  const [serviceStaff, setServiceStaff] = useState<{ id: number; name: string }[]>([]);
  const [settleExternalRef, setSettleExternalRef] = useState<string | null>(null);
  const [serverOffline, setServerOffline] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [storeLines, setStoreLines] = useState<StoreLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [selectedQty, setSelectedQty] = useState(1);
  const [storeSectionOpen, setStoreSectionOpen] = useState(false);

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
        paidAmount: calculatedAmount,
        debtAmount: 0,
        tipAmount: 0,
        tipRecipientType: '',
        tipRecipientEmployeeId: null,
        tipTeamMemberIds: [],
        paymentMethod: 'CASH',
        accountId: null,
        notes: '',
      });
      setOpenDebts(null);
      setStoreLines([]);
      setProductSearch('');
      setSelectedProductId('');
      setSelectedQty(1);
      setStoreSectionOpen(false);

      // Load bank accounts + open debts warning
      if (reachable) {
        const customerId = (apptData as Appointment).customerId;
        const [accountsResponse, staffResponse, debtsResponse, productsResponse] = await Promise.all([
          api.get('/accounting/accounts'),
          api.get('/employees/service-staff/active').catch(() => ({ data: [] })),
          customerId
            ? api.get(`/customers/${customerId}/open-debts`).catch(() => null)
            : Promise.resolve(null),
          api.get('/products', { params: { isActive: true, limit: 100 } }).catch(() => ({ data: { data: [] } })),
        ]);
        await cacheFromResponse(REFERENCE_KEYS.accounts, accountsResponse.data);
        setAccounts(accountsResponse.data);
        setServiceStaff(staffResponse.data || []);
        setCatalogProducts(productsResponse.data?.data || []);
        if (debtsResponse?.data) {
          setOpenDebts(debtsResponse.data as OpenDebtsSummary);
        }

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
      if (storeLines.length > 0) {
        toast({
          title: 'غیرفعال در حالت آفلاین',
          description: 'فروش فروشگاه در حالت آفلاین امکان‌پذیر نیست.',
          variant: 'destructive',
        });
        return;
      }
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

    if (formData.paidAmount > 0 && !formData.accountId) {
      toast({
        title: 'خطا',
        description: 'انتخاب حساب بانکی برای مبلغ پرداختی الزامی است',
        variant: 'destructive',
      });
      return;
    }

    if (formData.paidAmount + formData.debtAmount !== formData.amount) {
      toast({
        title: 'خطا',
        description: 'جمع مبلغ پرداختی و بدهی باید برابر مبلغ کل باشد',
        variant: 'destructive',
      });
      return;
    }

    if (formData.paidAmount > 0 && formData.paymentMethod === 'DEBT') {
      toast({
        title: 'خطا',
        description: 'برای بخش پرداخت‌شده روش نقدی یا کارت را انتخاب کنید',
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
      if (
        formData.tipRecipientType === 'TEAM' &&
        formData.tipTeamMemberIds.length === 0
      ) {
        toast({
          title: 'خطا',
          description: 'حداقل یک پرسنل خدمات برای انعام تیمی انتخاب کنید',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setLoading(true);

      const payload: Record<string, unknown> = {
        amount: formData.amount, // Already in RIAL
        paidAmount: formData.paidAmount,
        debtAmount: formData.debtAmount,
        tipAmount: formData.tipAmount || 0, // Already in RIAL
        paymentMethod: formData.paymentMethod,
        accountId: formData.paidAmount > 0 ? formData.accountId : undefined,
        notes: formData.notes || undefined,
        externalRef: generateIdempotencyKey(),
      };

      if (formData.tipAmount > 0) {
        payload.tipRecipientType = formData.tipRecipientType;
        if (formData.tipRecipientType === 'INDIVIDUAL') {
          payload.tipRecipientEmployeeId = formData.tipRecipientEmployeeId;
        }
        if (formData.tipRecipientType === 'TEAM') {
          payload.tipTeamMemberIds = formData.tipTeamMemberIds;
        }
      }
      if (storeLines.length > 0) {
        payload.items = storeLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        }));
      }

      console.log('💸 Settling appointment:', payload);

      await api.post(`/appointments/${appointmentId}/settle`, payload);

      toast({
        title:
          formData.debtAmount > 0 && formData.paidAmount > 0
            ? 'تسویه ترکیبی ثبت شد'
            : formData.debtAmount > 0
              ? 'بدهی ثبت شد'
              : 'تسویه انجام شد',
        description:
          formData.debtAmount > 0 && formData.paidAmount > 0
            ? 'بخشی پرداخت و باقیمانده به‌عنوان بدهی ثبت شد'
            : formData.debtAmount > 0
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
        description:
          error.response?.data?.message_fa ||
          error.response?.data?.message ||
          'تسویه نوبت با خطا مواجه شد',
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

  const storeSubtotalRial = storeLines.reduce(
    (sum, line) => sum + Number(line.unitPriceRial) * line.quantity,
    0,
  );

  const filteredCatalog = catalogProducts.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  const addStoreLine = () => {
    if (!selectedProductId) return;
    const product = catalogProducts.find((p) => p.id === selectedProductId);
    if (!product) return;
    const qty = Math.max(1, selectedQty);
    const already = storeLines.find((l) => l.productId === product.id);
    const nextQty = (already?.quantity || 0) + qty;
    if (nextQty > product.stock) {
      toast({
        title: 'خطا',
        description: `موجودی کافی نیست: ${product.name}`,
        variant: 'destructive',
      });
      return;
    }
    if (already) {
      setStoreLines(
        storeLines.map((l) =>
          l.productId === product.id ? { ...l, quantity: nextQty } : l,
        ),
      );
    } else {
      setStoreLines([
        ...storeLines,
        {
          productId: product.id,
          name: product.name,
          quantity: qty,
          unitPriceRial: product.priceRial,
          stock: product.stock,
        },
      ]);
    }
    setSelectedQty(1);
  };

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
            {openDebts && openDebts.count > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-1">
                  <p className="font-semibold">
                    هشدار: این مشتری {openDebts.count} بدهی باز دارد (جمع:{' '}
                    {formatTomansFromRial(openDebts.totalOpenRial)})
                  </p>
                  <ul className="text-xs list-disc pr-4 space-y-0.5 max-h-24 overflow-y-auto">
                    {openDebts.debts.slice(0, 5).map((d) => (
                      <li key={d.id}>
                        {formatTomansFromRial(d.amountRial)}
                        {d.appointmentScheduledAt
                          ? ` — نوبت ${formatToJalali(d.appointmentScheduledAt)}`
                          : ` — ${formatToJalali(d.createdAt)}`}
                        {d.appointmentId ? ` (#${d.appointmentId})` : ''}
                      </li>
                    ))}
                  </ul>
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
                <span className="font-semibold">جمع خدمات:</span>
                <span className="font-bold text-main-orange">
                  {toTomans(calculatedTotal)}
                </span>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
              <button
                type="button"
                className="w-full text-sm font-medium flex items-center justify-between gap-2"
                onClick={() => setStoreSectionOpen((open) => !open)}
                aria-expanded={storeSectionOpen}
              >
                <span className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  فروش محصولات انبار
                  {storeLines.length > 0 ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      ({storeLines.length} قلم)
                    </span>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">(اختیاری)</span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${storeSectionOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {storeSectionOpen && (
                <>
              <p className="text-xs text-muted-foreground">
                مبلغ فروشگاه جدا از مبلغ نوبت است و در کمیسیون آرایشگر محاسبه نمی‌شود.
              </p>
              <Input
                placeholder="جستجوی محصول..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
                  value={selectedProductId}
                  onChange={(e) =>
                    setSelectedProductId(e.target.value ? Number(e.target.value) : '')
                  }
                >
                  <option value="">انتخاب محصول</option>
                  {filteredCatalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {formatTomansFromRial(p.priceRial)} (موجودی {p.stock})
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min={1}
                  className="sm:w-24"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(Math.max(1, Number(e.target.value) || 1))}
                />
                <Button type="button" variant="outline" onClick={addStoreLine}>
                  <Plus className="h-4 w-4 ml-1" />
                  افزودن
                </Button>
              </div>
              {storeLines.length > 0 && (
                <ul className="text-sm space-y-1">
                  {storeLines.map((line) => (
                    <li key={line.productId} className="flex items-center justify-between gap-2">
                      <span>
                        {line.name} × {line.quantity} @ {formatTomansFromRial(line.unitPriceRial)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() =>
                          setStoreLines(storeLines.filter((l) => l.productId !== line.productId))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
                </>
              )}
              <div className="flex justify-between pt-2 border-t text-sm">
                <span className="font-semibold">جمع فروشگاه:</span>
                <span className="font-bold">{formatTomansFromRial(storeSubtotalRial)}</span>
              </div>
            </div>

            {/* Amount Input - Editable */}
            <div className="space-y-2">
              <MoneyInput
                value={formData.amount}
                onChange={(amount) => {
                  const method = formData.paymentMethod;
                  if (method === 'DEBT') {
                    setFormData({ ...formData, amount, paidAmount: 0, debtAmount: amount });
                  } else {
                    setFormData({
                      ...formData,
                      amount,
                      paidAmount: Math.max(0, amount - formData.debtAmount),
                      debtAmount: Math.min(formData.debtAmount, amount),
                    });
                  }
                }}
                label="مبلغ نهایی *"
                placeholder="مثال: 500,000"
                required
              />
              <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1">
                مبلغ قابل ویرایش است در صورت تغییر توافق با مشتری
              </p>
            </div>

            <MoneyInput
              value={formData.paidAmount}
              onChange={(paidAmount) => {
                const clamped = Math.min(Math.max(0, paidAmount), formData.amount);
                setFormData({
                  ...formData,
                  paidAmount: clamped,
                  debtAmount: formData.amount - clamped,
                  paymentMethod:
                    clamped === 0
                      ? 'DEBT'
                      : formData.paymentMethod === 'DEBT'
                        ? 'CASH'
                        : formData.paymentMethod,
                });
              }}
              label="مبلغ پرداختی الان"
              placeholder="مثال: 300,000"
            />
            <MoneyInput
              value={formData.debtAmount}
              onChange={(debtAmount) => {
                const clamped = Math.min(Math.max(0, debtAmount), formData.amount);
                setFormData({
                  ...formData,
                  debtAmount: clamped,
                  paidAmount: formData.amount - clamped,
                  paymentMethod:
                    formData.amount - clamped === 0
                      ? 'DEBT'
                      : formData.paymentMethod === 'DEBT'
                        ? 'CASH'
                        : formData.paymentMethod,
                });
              }}
              label="مبلغ بدهی (باقیمانده)"
              placeholder="مثال: 200,000"
            />

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">خلاصه سهم آرایشگر (برای تسویه حقوق)</p>
              <p>کسورات مالیات سهم آرایشگر هر نوبت: {toTomans(BARBER_APPOINTMENT_DEDUCTION_TOMAN * 10)}</p>
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
                  tipTeamMemberIds: tipAmount > 0 ? formData.tipTeamMemberIds : [],
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
                        tipTeamMemberIds:
                          value === 'INDIVIDUAL' ? [] : formData.tipTeamMemberIds,
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
                      ۱۰۰٪ انعام به این پرسنل؛ آرایشگر قابل انتخاب نیست
                    </p>
                  </div>
                )}

                {formData.tipRecipientType === 'TEAM' && (
                  <div className="space-y-2">
                    <Label>اعضای تیم خدمات *</Label>
                    <p className="text-xs text-muted-foreground">
                      ۵۰٪ سهم تیمی آرایشگر نوبت + ۵۰٪ مساوی بین افراد انتخاب‌شده
                    </p>
                    <div className="max-h-40 overflow-y-auto space-y-2 rounded border p-2">
                      {serviceStaff.length === 0 ? (
                        <p className="text-xs text-muted-foreground">پرسنل خدمات فعالی نیست</p>
                      ) : (
                        serviceStaff.map((staff) => {
                          const checked = formData.tipTeamMemberIds.includes(staff.id);
                          return (
                            <label
                              key={staff.id}
                              className="flex items-center gap-2 text-sm cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? formData.tipTeamMemberIds.filter((id) => id !== staff.id)
                                    : [...formData.tipTeamMemberIds, staff.id];
                                  setFormData({ ...formData, tipTeamMemberIds: next });
                                }}
                              />
                              {staff.name}
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Method */}
            <div>
              <Label>روش پرداخت *</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(val) => {
                  const method = val as 'CASH' | 'CARD' | 'CARD2CARD' | 'DEBT';
                  if (method === 'DEBT') {
                    setFormData({
                      ...formData,
                      paymentMethod: method,
                      paidAmount: 0,
                      debtAmount: formData.amount,
                    });
                  } else {
                    setFormData({
                      ...formData,
                      paymentMethod: method,
                      paidAmount: (formData.amount - formData.debtAmount) || formData.amount,
                      debtAmount:
                        formData.debtAmount > 0 && formData.debtAmount < formData.amount
                          ? formData.debtAmount
                          : 0,
                    });
                  }
                }}
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

            {/* Bank Account (hidden when no paid portion) */}
            {formData.paidAmount > 0 && (
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
            {formData.debtAmount > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {formData.paidAmount > 0
                    ? `${formatTomansFromRial(formData.debtAmount)} به‌عنوان بدهی باقیمانده ثبت می‌شود.`
                    : 'کل مبلغ به‌عنوان بدهی مشتری ثبت خواهد شد.'}
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

