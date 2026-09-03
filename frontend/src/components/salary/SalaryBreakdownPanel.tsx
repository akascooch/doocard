'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatTomansFromRial } from '@/lib/money';

export type SalaryBreakdownItem = {
  key: string;
  label: string;
  amount: string;
  description?: string;
};

export type SalaryBreakdown = {
  currencyBase?: 'IRR';
  displayCurrency?: 'TOMAN';
  role?: 'BARBER' | 'SERVICE';
  isServiceStaff?: boolean;
  grossAmount: string;
  shopShareAmount: string;
  employeeShareAmount: string;
  tipAmount: string;
  teamTipAmount?: string;
  deductionAmount: string;
  paidAmount: string;
  finalAmount: string;
  settlementPayable?: string;
  appointmentCount?: number;
  serviceCount?: number;
  tipAllocationCount?: number;
  commissionPercentageUsed?: number;
  breakdownItems?: SalaryBreakdownItem[];
};

type Props = {
  breakdown: SalaryBreakdown;
  /** When false, only show non-zero detail rows (always keep final). Default true for preview. */
  showZeroRows?: boolean;
  defaultOpen?: boolean;
  className?: string;
};

export function SalaryBreakdownPanel({
  breakdown,
  showZeroRows = false,
  defaultOpen = true,
  className = '',
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  const items = useMemo(() => {
    const source =
      breakdown.breakdownItems && breakdown.breakdownItems.length > 0
        ? breakdown.breakdownItems
        : [
            { key: 'gross', label: 'جمع کل کارکرد', amount: breakdown.grossAmount },
            { key: 'shop_share', label: 'سهم آرایشگاه', amount: breakdown.shopShareAmount },
            { key: 'employee_share', label: 'سهم شما', amount: breakdown.employeeShareAmount },
            { key: 'tip', label: 'انعام', amount: breakdown.tipAmount },
            {
              key: 'team_tip',
              label: 'سهم تیمی',
              amount: breakdown.teamTipAmount || '0',
            },
            { key: 'deduction', label: 'کسورات', amount: breakdown.deductionAmount },
            { key: 'paid', label: 'پرداخت‌شده قبلی', amount: breakdown.paidAmount },
            { key: 'final', label: 'مبلغ نهایی', amount: breakdown.finalAmount },
          ];

    return source.filter((item) => {
      if (item.key === 'final' || item.key === 'admin_settlement') return true;
      if (showZeroRows) return true;
      try {
        return BigInt(String(item.amount || '0').replace(/[^\d-]/g, '') || '0') !== BigInt(0);
      } catch {
        return Number(item.amount) !== 0;
      }
    });
  }, [breakdown, showZeroRows]);

  const metaBits: string[] = [];
  if (!breakdown.isServiceStaff && (breakdown.appointmentCount ?? 0) > 0) {
    metaBits.push(`${breakdown.appointmentCount} نوبت`);
  }
  if (breakdown.isServiceStaff && (breakdown.tipAllocationCount ?? 0) > 0) {
    metaBits.push(`${breakdown.tipAllocationCount} انعام`);
  }
  if (!breakdown.isServiceStaff && (breakdown.commissionPercentageUsed ?? 0) > 0) {
    metaBits.push(`کمیسیون ${breakdown.commissionPercentageUsed}٪`);
  }

  return (
    <div className={`rounded-lg border bg-muted/20 ${className}`} dir="rtl">
      <Button
        type="button"
        variant="ghost"
        className="w-full justify-between px-4 py-3 h-auto font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span>جزئیات محاسبه</span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {metaBits.length > 0 && (
            <p className="text-xs text-muted-foreground">{metaBits.join(' · ')}</p>
          )}
          <div className="space-y-2">
            {items.map((item) => {
              const isFinal = item.key === 'final';
              const isAdminSettlement = item.key === 'admin_settlement';
              return (
                <div
                  key={item.key}
                  className={`flex items-start justify-between gap-3 text-sm ${
                    isFinal || isAdminSettlement ? 'pt-2 border-t font-semibold' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className={isFinal || isAdminSettlement ? 'text-foreground' : 'text-muted-foreground'}>
                      {item.label}
                    </div>
                    {item.description && (
                      <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <div
                    className={`shrink-0 tabular-nums ${
                      isFinal
                        ? 'text-green-700 dark:text-green-400'
                        : isAdminSettlement
                          ? 'text-emerald-800 dark:text-emerald-400'
                          : 'text-foreground'
                    }`}
                  >
                    {formatTomansFromRial(item.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
