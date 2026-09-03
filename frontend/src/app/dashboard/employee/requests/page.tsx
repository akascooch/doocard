'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { api } from '@/lib/axios';
import { useToast } from '@/components/ui/use-toast';
import { formatToJalali } from '@/lib/date';
import { toTomans } from '@/lib/money';

interface Service {
  serviceId: number;
  serviceName: string;
  priceAtBooking: number;
  durationMin: number;
}

interface Appointment {
  id: number;
  services: Service[];
  scheduledAt: string;
  durationMin: number;
  customerName: string;
  customerPhone: string;
  notes?: string;
}

interface AlternativeSlot {
  time: string;
  displayTime: string;
  endTime: string;
}

export default function EmployeeRequestsPage() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    appointmentId: number | null;
    alternatives: AlternativeSlot[];
  }>({
    open: false,
    appointmentId: null,
    alternatives: [],
  });

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/appointments', {
        params: { status: 'PENDING_CONFIRMATION' },
      });
      
      console.log('📋 Pending requests:', response.data);
      setRequests(response.data.data || response.data || []);
    } catch (error) {
      console.error('Error loading requests:', error);
      toast({
        title: '❌ خطا',
        description: 'بارگذاری درخواست‌ها با خطا مواجه شد',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (appointmentId: number) => {
    try {
      await api.post(`/appointments/${appointmentId}/confirm`);
      
      toast({
        title: '✅ تأیید شد',
        description: '👏 نوبت با موفقیت تأیید شد',
      });
      
      loadRequests();
    } catch (error: any) {
      console.error('Error confirming:', error);
      
      // Check if conflict with suggestions
      if (error.response?.data?.error === 'SLOT_CONFLICT' && error.response?.data?.suggestions) {
        setConflictDialog({
          open: true,
          appointmentId,
          alternatives: error.response.data.suggestions,
        });
      } else {
        toast({
          title: '❌ خطا',
          description: error.response?.data?.message || 'تأیید نوبت با خطا مواجه شد',
          variant: 'destructive',
        });
      }
    }
  };

  const handleReject = async (appointmentId: number) => {
    try {
      await api.post(`/appointments/${appointmentId}/cancel`);
      
      toast({
        title: '🚫 رد شد',
        description: 'درخواست نوبت رد شد',
      });
      
      loadRequests();
    } catch (error: any) {
      console.error('Error rejecting:', error);
      toast({
        title: '❌ خطا',
        description: error.response?.data?.message || 'رد نوبت با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  const handleSelectAlternative = async (slot: AlternativeSlot) => {
    if (!conflictDialog.appointmentId) return;

    try {
      // Update appointment with new time
      await api.patch(`/appointments/${conflictDialog.appointmentId}`, {
        scheduledAt: slot.time,
      });

      // Try to confirm again
      await api.post(`/appointments/${conflictDialog.appointmentId}/confirm`);

      toast({
        title: '✅ تأیید شد',
        description: 'نوبت با زمان جدید تأیید شد',
      });

      setConflictDialog({ open: false, appointmentId: null, alternatives: [] });
      loadRequests();
    } catch (error: any) {
      console.error('Error updating appointment:', error);
      toast({
        title: '❌ خطا',
        description: error.response?.data?.message || 'به‌روزرسانی با خطا مواجه شد',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">درخواست‌های نوبت</h1>
        <p className="text-muted-foreground mt-1">
          درخواست‌های نوبت در انتظار تأیید شما
        </p>
      </div>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            درخواست‌های جدید ({requests.length})
          </CardTitle>
          <CardDescription>
            {loading ? 'در حال بارگذاری...' : 'لیست درخواست‌هایی که نیاز به بررسی دارند'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-main-orange"></div>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>درخواست جدیدی وجود ندارد</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">تاریخ و ساعت</TableHead>
                    <TableHead className="text-right">مشتری</TableHead>
                    <TableHead className="text-right">سرویس‌ها</TableHead>
                    <TableHead className="text-right">مدت زمان</TableHead>
                    <TableHead className="text-right">یادداشت</TableHead>
                    <TableHead className="text-right">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{formatToJalali(request.scheduledAt, 'YYYY/MM/DD')}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(request.scheduledAt).toLocaleTimeString('fa-IR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Asia/Tehran',
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{request.customerName}</div>
                          <div className="text-sm text-muted-foreground">{request.customerPhone}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {request.services?.map((s, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {s?.serviceName || 'خدمت'}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{request.durationMin} دقیقه</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {request.notes || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleConfirm(request.id)}
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="h-4 w-4 ml-1" />
                            تأیید
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(request.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <XCircle className="h-4 w-4 ml-1" />
                            رد
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conflict Dialog with Alternatives */}
      <Dialog open={conflictDialog.open} onOpenChange={(open) => !open && setConflictDialog({ open: false, appointmentId: null, alternatives: [] })}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              تداخل زمانی!
            </DialogTitle>
            <DialogDescription>
              این زمان قبلاً رزرو شده است. لطفاً یکی از زمان‌های جایگزین را انتخاب کنید:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {conflictDialog.alternatives.length > 0 ? (
              conflictDialog.alternatives.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border rounded-lg hover:border-main-orange cursor-pointer transition-colors"
                  onClick={() => handleSelectAlternative(slot)}
                >
                  <div className="text-right">
                    <div className="font-medium">{slot.displayTime}</div>
                    <div className="text-xs text-muted-foreground">
                      تا {new Date(slot.endTime).toLocaleTimeString('fa-IR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'Asia/Tehran',
                      })}
                    </div>
                  </div>
                  <Button size="sm" className="bg-main-orange hover:bg-main-orange/90">
                    انتخاب
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-4">
                زمان خالی دیگری موجود نیست
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setConflictDialog({ open: false, appointmentId: null, alternatives: [] })}
            >
              انصراف
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

