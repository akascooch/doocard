'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatTomansFromRial } from '@/lib/money';

export type ServiceTipLine = {
  allocationId: number;
  appointmentId: number | null;
  tipSourceId?: number | null;
  origin?: 'APPOINTMENT' | 'MANUAL';
  paidAt?: string | null;
  paidAtJalali?: string | null;
  scheduledAt?: string | null;
  scheduledAtJalali?: string | null;
  barberEmployeeId?: number | null;
  barberName: string;
  tipRecipientType: 'INDIVIDUAL' | 'TEAM' | null;
  tipAmountTotalRial?: string;
  myShareRial: string;
  originLabel: string;
  serviceNames?: string[];
  customerName?: string | null;
};

type Props = {
  tipLines?: ServiceTipLine[] | null;
  /** When true, tipLines key was present but empty or intentionally unavailable. */
  tipLinesKnownMissing?: boolean;
  emptyMessage?: string;
  missingSnapshotMessage?: string;
  className?: string;
  showExtras?: boolean;
  title?: string;
};

function tipTypeLabel(type: ServiceTipLine['tipRecipientType']): string {
  if (type === 'INDIVIDUAL') return 'فردی';
  if (type === 'TEAM') return 'تیمی';
  return 'نامشخص';
}

export function ServiceTipLinesTable({
  tipLines,
  tipLinesKnownMissing = false,
  emptyMessage = 'ردیفی برای نمایش وجود ندارد',
  missingSnapshotMessage = 'جزئیات انعام برای این درخواست قدیمی ذخیره نشده است.',
  className = '',
  showExtras = true,
  title = 'جزئیات انعام‌ها',
}: Props) {
  if (tipLines == null) {
    if (!tipLinesKnownMissing) return null;
    return (
      <div
        className={`rounded-lg border border-dashed bg-muted/10 px-4 py-3 text-sm text-muted-foreground ${className}`}
        dir="rtl"
      >
        {missingSnapshotMessage}
      </div>
    );
  }

  if (tipLines.length === 0) {
    return (
      <div
        className={`rounded-lg border bg-muted/10 px-4 py-3 text-sm text-muted-foreground ${className}`}
        dir="rtl"
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`rounded-lg border ${className}`} dir="rtl">
      <div className="px-4 py-3 border-b">
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {tipLines.length} ردیف — منبع هر انعام (نوبت و آرایشگر)
        </p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">تاریخ</TableHead>
              <TableHead className="text-right">شماره نوبت</TableHead>
              <TableHead className="text-right">آرایشگر</TableHead>
              <TableHead className="text-right">نوع انعام</TableHead>
              <TableHead className="text-right">سهم من</TableHead>
              {showExtras && <TableHead className="text-right">خدمات</TableHead>}
              {showExtras && <TableHead className="text-right">مشتری</TableHead>}
              <TableHead className="text-right">توضیحات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipLines.map((line) => (
              <TableRow key={line.allocationId}>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {line.paidAtJalali || line.scheduledAtJalali || '—'}
                </TableCell>
                <TableCell className="tabular-nums">
                  {line.appointmentId != null
                    ? `#${line.appointmentId}`
                    : line.tipSourceId != null
                      ? `دستی #${line.tipSourceId}`
                      : '—'}
                </TableCell>
                <TableCell>{line.barberName || 'نامشخص'}</TableCell>
                <TableCell>{tipTypeLabel(line.tipRecipientType)}</TableCell>
                <TableCell className="tabular-nums font-medium text-green-700 dark:text-green-400">
                  {formatTomansFromRial(line.myShareRial)}
                </TableCell>
                {showExtras && (
                  <TableCell className="text-xs text-muted-foreground max-w-[140px]">
                    {(line.serviceNames || []).length > 0
                      ? line.serviceNames!.join('، ')
                      : '—'}
                  </TableCell>
                )}
                {showExtras && (
                  <TableCell className="text-sm">{line.customerName || '—'}</TableCell>
                )}
                <TableCell className="text-xs text-muted-foreground max-w-[240px]">
                  {line.originLabel}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
