'use client';

import { useState } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertTriangle,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { api } from '@/lib/axios';

interface CustomerPreview {
  previewToken: string;
  filename: string;
  totalDataRows: number;
  parsedRows: number;
  parseFailureCount: number;
  parseFailures: Array<{ rowNumber: number; reason: string; phone?: string }>;
  newCustomerCount: number;
  eligibleRowCount: number;
  existingInDbCount: number;
  inFileDuplicateCount: number;
  duplicatePhones: Array<{
    phone: string;
    rowNumbers: number[];
    reason: 'in_file' | 'existing_db' | 'both';
  }>;
  canCommit: boolean;
}

interface DateGroup {
  jalaliDateKey: string;
  jalaliDateRaw: string;
  rowCount: number;
  excelRowCount: number;
  dbAppointmentCount: number;
  status: 'eligible' | 'count_matched_skipped';
  duplicateCount: number;
  rowNumbers: number[];
}

interface AppointmentPreview {
  previewToken: string;
  filename: string;
  totalDataRows: number;
  parsedRows: number;
  parseFailureCount: number;
  parseFailures: Array<{ rowNumber: number; reason: string; jalaliDateRaw?: string }>;
  skippedMatchedDays: Array<{
    jalaliDateKey: string;
    jalaliDateRaw: string;
    excelRowCount: number;
    dbAppointmentCount: number;
    rowNumbers: number[];
  }>;
  skippedMatchedRowCount: number;
  skippedSingletonRowCount?: number;
  eligibleRowCount: number;
  duplicateRowCount: number;
  inFileDuplicateRows: number;
  existingDbDuplicateKeys: number;
  duplicateCandidates: Array<{
    dedupKey: string;
    rowNumbers: number[];
    reason: 'in_file' | 'existing_db' | 'both';
  }>;
  dateGroups: DateGroup[];
  canCommit: boolean;
}

export default function ImportDataPage() {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [customerSelectedFile, setCustomerSelectedFile] = useState<File | null>(null);
  const [appointmentSelectedFile, setAppointmentSelectedFile] = useState<File | null>(null);
  const [customerPreview, setCustomerPreview] = useState<CustomerPreview | null>(null);
  const [appointmentPreview, setAppointmentPreview] = useState<AppointmentPreview | null>(null);
  const [customerConfirmOpen, setCustomerConfirmOpen] = useState(false);
  const [appointmentConfirmOpen, setAppointmentConfirmOpen] = useState(false);

  const handleDownloadTemplate = async (entity: string) => {
    try {
      const response = await api.get(`/import/templates/${entity.toLowerCase()}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${entity.toLowerCase()}-template.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({ title: '✅ دانلود موفق', description: `تمپلیت ${entity} دانلود شد` });
    } catch {
      toast({ title: 'خطا', description: 'خطا در دانلود تمپلیت', variant: 'destructive' });
    }
  };

  const handleCustomerPreview = async () => {
    if (!customerSelectedFile) {
      toast({ title: 'فایل انتخاب نشده', description: 'لطفاً یک فایل Excel انتخاب کنید', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      setCustomerPreview(null);

      const formData = new FormData();
      formData.append('file', customerSelectedFile);
      formData.append('entity', 'CUSTOMERS');

      const response = await api.post('/import/upload', formData);
      setCustomerPreview(response.data);

      toast({
        title: '✅ پیش‌نمایش آماده است',
        description: `${response.data.newCustomerCount} مشتری جدید، ${response.data.existingInDbCount} قبلاً در سیستم وجود دارد`,
      });
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در پردازش فایل',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCustomerCommit = async () => {
    if (!customerPreview?.previewToken) return;

    try {
      setCommitting(true);
      const response = await api.post('/import/commit', {
        batchId: customerPreview.previewToken,
        entity: 'CUSTOMERS',
        confirmed: true,
      });

      setCustomerConfirmOpen(false);
      toast({
        title: '✅ import انجام شد',
        description: `${response.data.created} مشتری ایجاد شد، ${response.data.skippedDuplicate ?? 0} تکراری رد شد`,
      });
      setCustomerPreview(null);
      setCustomerSelectedFile(null);
    } catch (error: any) {
      toast({
        title: 'خطا در import',
        description: error.response?.data?.message || 'خطا در ثبت نهایی',
        variant: 'destructive',
      });
    } finally {
      setCommitting(false);
    }
  };

  const handleAppointmentPreview = async () => {
    if (!appointmentSelectedFile) {
      toast({ title: 'فایل انتخاب نشده', description: 'لطفاً یک فایل Excel انتخاب کنید', variant: 'destructive' });
      return;
    }

    try {
      setUploading(true);
      setAppointmentPreview(null);

      const formData = new FormData();
      formData.append('file', appointmentSelectedFile);
      formData.append('entity', 'APPOINTMENTS');

      const response = await api.post('/import/upload', formData);
      setAppointmentPreview(response.data);

      toast({
        title: '✅ پیش‌نمایش آماده است',
        description: `${response.data.eligibleRowCount} نوبت قابل import، ${response.data.skippedMatchedRowCount ?? response.data.skippedSingletonRowCount ?? 0} ردیف در تاریخ‌های هم‌تعداد با DB حذف شد`,
      });
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در پردازش فایل',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAppointmentCommit = async () => {
    if (!appointmentPreview?.previewToken) return;

    try {
      setCommitting(true);
      const response = await api.post('/import/commit', {
        batchId: appointmentPreview.previewToken,
        entity: 'APPOINTMENTS',
        confirmed: true,
        createMissing: true,
        createIncomeTx: true,
      });

      setAppointmentConfirmOpen(false);
      toast({
        title: '✅ import انجام شد',
        description: `${response.data.created} نوبت ایجاد شد، ${response.data.skippedDuplicate} تکراری رد شد`,
      });
      setAppointmentPreview(null);
      setAppointmentSelectedFile(null);
    } catch (error: any) {
      toast({
        title: 'خطا در import',
        description: error.response?.data?.message || 'خطا در ثبت نهایی',
        variant: 'destructive',
      });
    } finally {
      setCommitting(false);
    }
  };

  const renderCustomerTab = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          مشتریان (تمپلیت استاندارد)
        </CardTitle>
        <CardDescription>
          فایل Excel مشتریان را انتخاب کنید، پیش‌نمایش را بررسی کنید، سپس import را تأیید کنید.
          مشتریانی که شماره تلفن آن‌ها در سیستم وجود دارد، وارد نمی‌شوند.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button variant="outline" onClick={() => handleDownloadTemplate('CUSTOMERS')}>
          <Download className="h-4 w-4 ml-2" />
          دانلود تمپلیت مشتریان
        </Button>

        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setCustomerSelectedFile(file ?? null);
              setCustomerPreview(null);
            }}
            className="hidden"
            id="file-upload-customers"
          />
          <label htmlFor="file-upload-customers" className="cursor-pointer block">
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">فایل Excel مشتریان را انتخاب کنید</p>
            <p className="text-sm text-muted-foreground">فرمت: .xlsx / .xls — تمپلیت استاندارد</p>
            {customerSelectedFile && (
              <p className="mt-4 text-sm text-primary font-medium">✓ {customerSelectedFile.name}</p>
            )}
          </label>
        </div>

        <Button
          onClick={handleCustomerPreview}
          disabled={!customerSelectedFile || uploading}
          className="w-full md:w-auto"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              در حال پردازش...
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              پیش‌نمایش و تحلیل فایل
            </>
          )}
        </Button>

        {customerPreview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={CheckCircle} color="green" value={customerPreview.newCustomerCount} label="مشتری جدید" />
              <StatCard
                icon={AlertTriangle}
                color="amber"
                value={customerPreview.existingInDbCount}
                label="قبلاً وجود دارد (رد)"
              />
              <StatCard icon={XCircle} color="red" value={customerPreview.parseFailureCount} label="خطای parse" />
              <StatCard icon={FileSpreadsheet} color="blue" value={customerPreview.inFileDuplicateCount} label="تکراری در فایل" />
            </div>

            {customerPreview.parseFailures.length > 0 && (
              <WarningList
                title={`خطاهای parse (${customerPreview.parseFailures.length})`}
                items={customerPreview.parseFailures.map(
                  (f) => `ردیف ${f.rowNumber}: ${f.reason}${f.phone ? ` (${f.phone})` : ''}`,
                )}
              />
            )}

            {customerPreview.duplicatePhones.length > 0 && (
              <WarningList
                title={`شماره‌های تکراری (${customerPreview.duplicatePhones.length})`}
                items={customerPreview.duplicatePhones.map(
                  (d) =>
                    `${d.phone} — ردیف‌های ${d.rowNumbers.join(', ')} — ${
                      d.reason === 'both' ? 'در فایل و DB' : d.reason === 'in_file' ? 'در فایل' : 'در DB'
                    }`,
                )}
              />
            )}

            {customerPreview.canCommit ? (
              <Button onClick={() => setCustomerConfirmOpen(true)} className="w-full md:w-auto">
                <CheckCircle className="h-4 w-4 ml-2" />
                تأیید و وارد کردن به سیستم
              </Button>
            ) : (
              <p className="text-sm text-destructive">هیچ مشتری جدیدی برای import وجود ندارد.</p>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={customerConfirmOpen} onOpenChange={setCustomerConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأیید import مشتریان</DialogTitle>
            <DialogDescription>
              پس از تأیید، {customerPreview?.newCustomerCount ?? 0} مشتری جدید وارد سیستم می‌شود.
              {customerPreview?.existingInDbCount
                ? ` ${customerPreview.existingInDbCount} مشتری با شماره تکراری در DB رد می‌شوند.`
                : ''}
              {customerPreview?.inFileDuplicateCount
                ? ` ${customerPreview.inFileDuplicateCount} ردیف تکراری در فایل نادیده گرفته می‌شود.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setCustomerConfirmOpen(false)} disabled={committing}>
              انصراف
            </Button>
            <Button onClick={handleCustomerCommit} disabled={committing}>
              {committing ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  در حال import...
                </>
              ) : (
                'بله، import کن'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );

  const renderAppointmentsTab = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          نوبت‌ها — خروجی خام Excel
        </CardTitle>
        <CardDescription>
          فایل خروجی «ارائه خدمات» را انتخاب کنید، پیش‌نمایش گروه‌بندی‌شده را بررسی کنید، سپس import را تأیید کنید.
          روزهایی که تعداد نوبت Excel با DB برابر است، در import حذف می‌شوند.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setAppointmentSelectedFile(file ?? null);
              setAppointmentPreview(null);
            }}
            className="hidden"
            id="file-upload-appointments"
          />
          <label htmlFor="file-upload-appointments" className="cursor-pointer block">
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">فایل Excel را انتخاب کنید</p>
            <p className="text-sm text-muted-foreground">فرمت: .xlsx / .xls — فایل خام بدون ویرایش دستی</p>
            {appointmentSelectedFile && (
              <p className="mt-4 text-sm text-primary font-medium">✓ {appointmentSelectedFile.name}</p>
            )}
          </label>
        </div>

        <Button
          onClick={handleAppointmentPreview}
          disabled={!appointmentSelectedFile || uploading}
          className="w-full md:w-auto"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
              در حال پردازش...
            </>
          ) : (
            <>
              <FileSpreadsheet className="h-4 w-4 ml-2" />
              پیش‌نمایش و تحلیل فایل
            </>
          )}
        </Button>

        {appointmentPreview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={CheckCircle} color="green" value={appointmentPreview.eligibleRowCount} label="قابل import" />
              <StatCard
                icon={AlertTriangle}
                color="amber"
                value={appointmentPreview.skippedMatchedRowCount ?? appointmentPreview.skippedSingletonRowCount ?? 0}
                label="تاریخ هم‌تعداد (حذف)"
              />
              <StatCard icon={XCircle} color="red" value={appointmentPreview.parseFailureCount} label="خطای parse" />
              <StatCard icon={FileSpreadsheet} color="blue" value={appointmentPreview.duplicateRowCount} label="تکراری" />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">گروه‌بندی بر اساس تاریخ</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-right">
                        <th className="p-2">تاریخ</th>
                        <th className="p-2">Excel</th>
                        <th className="p-2">DB</th>
                        <th className="p-2">وضعیت</th>
                        <th className="p-2">تکراری</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointmentPreview.dateGroups.map((g) => (
                        <tr key={g.jalaliDateKey} className="border-b border-border/50">
                          <td className="p-2 font-mono">{g.jalaliDateRaw || g.jalaliDateKey}</td>
                          <td className="p-2">{g.excelRowCount ?? g.rowCount}</td>
                          <td className="p-2">{g.dbAppointmentCount ?? '—'}</td>
                          <td className="p-2">
                            {g.status === 'count_matched_skipped' ? (
                              <span className="text-amber-600">حذف (هم‌تعداد)</span>
                            ) : (
                              <span className="text-green-600">قابل import</span>
                            )}
                          </td>
                          <td className="p-2">{g.duplicateCount > 0 ? g.duplicateCount : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {appointmentPreview.parseFailures.length > 0 && (
              <WarningList
                title={`خطاهای parse (${appointmentPreview.parseFailures.length})`}
                items={appointmentPreview.parseFailures.map(
                  (f) => `ردیف ${f.rowNumber}: ${f.reason}${f.jalaliDateRaw ? ` (${f.jalaliDateRaw})` : ''}`,
                )}
              />
            )}

            {appointmentPreview.duplicateCandidates.length > 0 && (
              <WarningList
                title={`تکراری‌های احتمالی (${appointmentPreview.duplicateCandidates.length})`}
                items={appointmentPreview.duplicateCandidates.map(
                  (d) => `ردیف‌های ${d.rowNumbers.join(', ')} — ${d.reason === 'both' ? 'در فایل و DB' : d.reason === 'in_file' ? 'در فایل' : 'در DB'}`,
                )}
              />
            )}

            {appointmentPreview.canCommit ? (
              <Button onClick={() => setAppointmentConfirmOpen(true)} className="w-full md:w-auto">
                <CheckCircle className="h-4 w-4 ml-2" />
                تأیید و وارد کردن به سیستم
              </Button>
            ) : (
              <p className="text-sm text-destructive">هیچ ردیف قابل import وجود ندارد.</p>
            )}
          </div>
        )}
      </CardContent>

      <Dialog open={appointmentConfirmOpen} onOpenChange={setAppointmentConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأیید import نوبت‌ها</DialogTitle>
            <DialogDescription>
              پس از تأیید، {appointmentPreview?.eligibleRowCount ?? 0} نوبت وارد سیستم می‌شود.
              {(appointmentPreview?.skippedMatchedRowCount ?? appointmentPreview?.skippedSingletonRowCount)
                ? ` ${appointmentPreview?.skippedMatchedRowCount ?? appointmentPreview?.skippedSingletonRowCount} ردیف در تاریخ‌های هم‌تعداد با DB وارد نمی‌شود.`
                : ''}
              {appointmentPreview?.duplicateRowCount
                ? ` تکراری‌ها (${appointmentPreview.duplicateRowCount} ردیف) رد می‌شوند.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setAppointmentConfirmOpen(false)} disabled={committing}>
              انصراف
            </Button>
            <Button onClick={handleAppointmentCommit} disabled={committing}>
              {committing ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  در حال import...
                </>
              ) : (
                'بله، import کن'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 px-4 md:py-8" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ایمپورت دیتا</h1>
        <p className="text-muted-foreground">آپلود فایل Excel، پیش‌نمایش و تأیید قبل از ثبت</p>
      </div>

      <Tabs defaultValue="appointments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appointments">نوبت‌ها</TabsTrigger>
          <TabsTrigger value="customers">مشتریان</TabsTrigger>
          <TabsTrigger value="employees">کارکنان</TabsTrigger>
          <TabsTrigger value="transactions">تراکنش‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments">{renderAppointmentsTab()}</TabsContent>
        <TabsContent value="customers">{renderCustomerTab()}</TabsContent>

        <TabsContent value="employees">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">🚧 این بخش در نسخه بعدی اضافه خواهد شد</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">🚧 این بخش در نسخه بعدی اضافه خواهد شد</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon: Icon,
  color,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  color: 'green' | 'red' | 'blue' | 'amber';
  value: number;
  label: string;
}) {
  const colors = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <Icon className={`h-8 w-8 ${colors[color]}`} />
          <div>
            <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function WarningList({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="border-amber-200 dark:border-amber-800">
      <CardHeader>
        <CardTitle className="text-amber-700 flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm max-h-48 overflow-auto">
          {items.map((item, i) => (
            <li key={i} className="text-amber-800 dark:text-amber-300">
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
