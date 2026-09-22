'use client';

import { useEffect, useState } from 'react';
import { Edit, Trash2, DollarSign, CheckCircle, XCircle, Clock, RotateCcw, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import PaymentModal from './PaymentModal';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { getApiErrorMessage, notifyError, notifySuccess } from '@/lib/notify';
import { formatAppointmentWhenTehran } from '@/lib/date';
import { toTomans } from '@/lib/money';
import {
  type AppointmentRecord,
  formatTipAssignmentLabel,
  getAppointmentServices,
} from '@/lib/appointment';

type Appointment = AppointmentRecord;

interface AppointmentListProps {
  appointments: Appointment[];
  userRole: 'ADMIN' | 'EMPLOYEE' | 'CUSTOMER';
  onRefresh: () => void;
}

type EligiblePackage = {
  id: string
  title: string | null
  remainingSessions: number
  totalSessions: number
}

export default function AppointmentList({
  appointments,
  userRole,
  onRefresh,
}: AppointmentListProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [settleId, setSettleId] = useState<number | null>(null);
  const [settleAppointment, setSettleAppointment] = useState<Appointment | null>(null);
  const [eligibleById, setEligibleById] = useState<Record<string, EligiblePackage[]>>({});
  const [consumingId, setConsumingId] = useState<string | null>(null);

  const appointmentIdsKey = appointments
    .map((item) => item.id)
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 40)
    .join(',');

  useEffect(() => {
    if (userRole === 'CUSTOMER' || !appointmentIdsKey) {
      setEligibleById({});
      return;
    }
    let cancelled = false;
    void api
      .get('/packages/eligible-batch', { params: { ids: appointmentIdsKey } })
      .then((res) => {
        if (!cancelled) setEligibleById(res.data.byAppointmentId || {});
      })
      .catch(() => {
        if (!cancelled) setEligibleById({});
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentIdsKey, userRole]);

  const consumePackage = async (appointmentId: number, packageId: string) => {
    setConsumingId(packageId);
    try {
      const res = await api.post(`/packages/${packageId}/consume`, { appointmentId });
      notifySuccess('یک جلسه از پکیج کسر شد');
      setEligibleById((current) => {
        const next = { ...(current || {}) };
        const remaining = res.data.remainingSessions as number;
        const status = res.data.status as string;
        const list = (next[String(appointmentId)] || []).map((item) =>
          item.id === packageId ? { ...item, remainingSessions: remaining } : item,
        );
        next[String(appointmentId)] =
          status === 'EXHAUSTED' || remaining <= 0
            ? list.filter((item) => item.id !== packageId)
            : list;
        return next;
      });
    } catch (error) {
      notifyError('پکیج', getApiErrorMessage(error, 'کسر جلسه ناموفق بود'));
    } finally {
      setConsumingId(null);
    }
  };

  const renderPackageHint = (appointment: Appointment) => {
    if (userRole === 'CUSTOMER') return null;
    const items = eligibleById[String(appointment.id)] || [];
    if (items.length === 0) return null;
    const remaining = items.reduce((sum, item) => sum + item.remainingSessions, 0);
    return (
      <div className="space-y-2 mt-2">
        <Badge variant="success" className="normal-case tracking-normal">
          دارای پکیج فعال ({remaining} جلسه باقی‌مانده)
        </Badge>
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant="outline"
            disabled={consumingId === item.id || appointment.status === 'CANCELLED'}
            onClick={() => void consumePackage(appointment.id, item.id)}
            className="min-h-9"
          >
            <Gift className="h-4 w-4 ml-1" />
            کسر جلسه از پکیج
            {item.title ? ` (${item.title})` : ''}
          </Button>
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      PENDING: { label: 'در انتظار', className: 'border-amber-400/30 text-amber-200' },
      PENDING_CONFIRMATION: {
        label: 'نیاز به تأیید',
        className: 'border-amber-400/40 text-amber-100 animate-pulse',
      },
      CONFIRMED: { label: 'تأیید شده', className: 'border-sky-400/30 text-sky-200' },
      COMPLETED: { label: 'انجام شده', className: 'border-emerald-400/30 text-emerald-200' },
      SETTLED: { label: 'تسویه شده', className: 'border-emerald-400/30 text-emerald-200' },
      PAID: { label: 'پرداخت شده', className: 'border-emerald-400/30 text-emerald-200' },
      CANCELLED: { label: 'لغو شده', className: 'border-white/20 text-zinc-300' },
    };

    const config = configs[status] || { label: status, className: '' };
    return (
      <Badge variant="glass" className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const handleConfirm = async (id: number) => {
    try {
      await api.post(`/appointments/${id}/confirm`);
      toast({
        title: '✅ نوبت تأیید شد',
        description: '👏 نوبت با موفقیت تأیید شد و به مشتری اطلاع داده خواهد شد',
      });
      onRefresh();
    } catch (error: any) {
      console.error('Error confirming appointment:', error);
      toast({
        title: '❌ خطا در تأیید',
        description: error.response?.data?.message || 'تأیید نوبت با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.post(`/appointments/${id}/cancel`);
      toast({
        title: '🚫 نوبت لغو شد',
        description: 'نوبت با موفقیت لغو شد',
      });
      onRefresh();
    } catch (error: any) {
      console.error('Error canceling appointment:', error);
      toast({
        title: '❌ خطا',
        description: error.response?.data?.message || 'لغو نوبت با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const handleRevertSettlement = async (id: number) => {
    try {
      await api.post(`/appointments/${id}/revert-settlement`);
      toast({
        title: '↩️ برگشت از تسویه',
        description: 'تسویه نوبت با موفقیت برگشت داده شد و اکنون می‌توانید نوبت را حذف کنید',
      });
      onRefresh();
    } catch (error: any) {
      console.error('Error reverting settlement:', error);
      toast({
        title: '❌ خطا',
        description: error.response?.data?.message || 'برگشت از تسویه با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await api.delete(`/appointments/${deleteId}`);
      toast({
        title: '🗑️ نوبت حذف شد',
        description: 'نوبت به طور کامل حذف شد',
      });
      setDeleteId(null);
      onRefresh();
    } catch (error: any) {
      console.error('Error deleting appointment:', error);
      toast({
        title: '❌ خطا',
        description: error.response?.data?.message || 'حذف نوبت با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const renderActions = (appointment: Appointment) => (
    <div className="flex flex-wrap gap-1">
      {(userRole === 'ADMIN' || userRole === 'EMPLOYEE') &&
        appointment.status === 'PENDING_CONFIRMATION' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleConfirm(appointment.id)}
            className="text-green-600 hover:text-green-700 min-h-9"
            title="تأیید نوبت"
          >
            <CheckCircle className="h-4 w-4 ml-1" />
            <span className="text-xs">تأیید</span>
          </Button>
        )}

      {userRole === 'ADMIN' &&
        appointment.status !== 'SETTLED' &&
        appointment.status !== 'PAID' &&
        appointment.status !== 'CANCELLED' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSettleId(appointment.id);
              setSettleAppointment(appointment);
            }}
            className="text-main-orange hover:text-main-orange/90 min-h-9"
            title="تسویه نوبت"
          >
            <DollarSign className="h-4 w-4 ml-1" />
            <span className="text-xs">تسویه</span>
          </Button>
        )}

      {userRole === 'ADMIN' &&
        (appointment.status === 'SETTLED' || appointment.status === 'PAID') && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRevertSettlement(appointment.id)}
            className="text-amber-700 hover:text-amber-800 min-h-9"
            title="برگشت از تسویه"
          >
            <RotateCcw className="h-4 w-4 ml-1" />
            <span className="text-xs">برگشت از تسویه</span>
          </Button>
        )}

      {appointment.status !== 'SETTLED' &&
        appointment.status !== 'PAID' &&
        appointment.status !== 'CANCELLED' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleCancel(appointment.id)}
            className="text-red-600 hover:text-red-700 min-h-9"
            title="لغو نوبت"
          >
            <XCircle className="h-4 w-4 ml-1" />
            <span className="text-xs">لغو</span>
          </Button>
        )}

      {userRole === 'ADMIN' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDeleteId(appointment.id)}
          className="text-red-600 hover:text-red-700 min-h-9"
          title="حذف نوبت"
        >
          <Trash2 className="h-4 w-4 ml-1" />
          <span className="text-xs">حذف</span>
        </Button>
      )}
    </div>
  );

  const getServiceLabel = (appointment: Appointment) =>
    getAppointmentServices(appointment)
      .map((s, idx) => s.serviceName || `سرویس ${idx + 1}`)
      .join('، ') || '—';

  const renderNotes = (notes?: string | null) => {
    const text = (notes || '').trim();
    if (!text) return null;
    return (
      <p
        className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words line-clamp-2 max-w-[16rem]"
        title={text}
      >
        <span className="font-medium text-foreground/70">یادداشت: </span>
        {text}
      </p>
    );
  };

  const renderTipSummary = (appointment: Appointment) => {
    if (!appointment.tipAmount || appointment.tipAmount <= 0) return null;
    const assignmentLabel = formatTipAssignmentLabel(appointment);
    return (
      <div className="text-xs text-foreground/80">
        + {toTomans(appointment.tipAmount)} انعام
        {assignmentLabel && (
          <span className="block text-[10px] text-muted-foreground">
            {assignmentLabel}
            {appointment.tipStaffShareRial != null &&
              ` — پرسنل: ${toTomans(appointment.tipStaffShareRial)}`}
          </span>
        )}
      </div>
    );
  };

  if (appointments.length === 0) {
    return (
      <div className="text-center py-12 text-foreground/80">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>هیچ نوبتی ثبت نشده است</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile card layout */}
      <div className="md:hidden space-y-3">
        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            className="rounded-lg border bg-card p-4 space-y-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{appointment.customerName}</p>
                <p className="text-sm text-muted-foreground">{getServiceLabel(appointment)}</p>
              </div>
              {getStatusBadge(appointment.status)}
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span data-cy="appointment-when">
                  {formatAppointmentWhenTehran(appointment.scheduledAt)}
                </span>
              </div>
              {userRole !== 'CUSTOMER' && appointment.amount ? (
                <div>
                  <p className="font-medium">{toTomans(appointment.amount)}</p>
                  {renderTipSummary(appointment)}
                </div>
              ) : null}
              {renderNotes(appointment.notes)}
              {renderPackageHint(appointment)}
            </div>
            {renderActions(appointment)}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">تاریخ و ساعت</TableHead>
              <TableHead className="text-right">مشتری</TableHead>
              <TableHead className="text-right">آرایشگر</TableHead>
              <TableHead className="text-right">سرویس‌ها</TableHead>
              <TableHead className="text-right">مدت زمان</TableHead>
              <TableHead className="text-right">وضعیت</TableHead>
              {userRole !== 'CUSTOMER' && (
                <TableHead className="text-right">مبلغ</TableHead>
              )}
              <TableHead className="text-right">عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appointment) => (
              <TableRow key={appointment.id}>
                <TableCell className="font-medium">
                  <div>
                    <div data-cy="appointment-when">{formatAppointmentWhenTehran(appointment.scheduledAt)}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <div>{appointment.customerName}</div>
                    {renderNotes(appointment.notes)}
                    {renderPackageHint(appointment)}
                  </div>
                </TableCell>
                <TableCell>{appointment.employeeName || 'نامشخص'}</TableCell>
                <TableCell>
                  <div className="max-w-xs">
                    {getAppointmentServices(appointment).map((s, idx) => (
                      <div key={idx} className="text-sm">
                        {s.serviceName || `سرویس ${idx + 1}`}
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>{appointment.durationMin} دقیقه</TableCell>
                <TableCell>{getStatusBadge(appointment.status)}</TableCell>
                {userRole !== 'CUSTOMER' && (
                  <TableCell>
                    {appointment.amount ? (
                      <div>
                        <div className="font-medium">{toTomans(appointment.amount)}</div>
                        {renderTipSummary(appointment)}
                      </div>
                    ) : (
                      <span className="text-foreground/80">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {renderActions(appointment)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        appointmentId={settleId}
        prefetchedAppointment={settleAppointment}
        isOpen={settleId !== null}
        onClose={() => {
          setSettleId(null);
          setSettleAppointment(null);
        }}
        onSuccess={onRefresh}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نوبت</AlertDialogTitle>
            <AlertDialogDescription>
              آیا از حذف این نوبت اطمینان دارید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

