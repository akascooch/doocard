export type SalaryBreakdownItemKey =
  | 'gross'
  | 'shop_share'
  | 'employee_share'
  | 'tip'
  | 'team_tip'
  | 'deduction'
  | 'paid'
  | 'final'
  | 'admin_settlement';

export interface SalaryBreakdownItemDto {
  key: SalaryBreakdownItemKey;
  label: string;
  amount: string; // IRR string
  description?: string;
}

/**
 * Transparent payroll breakdown for employee-facing salary UI.
 * All numeric amounts are IRR strings (backend source of truth).
 */
export interface SalaryBreakdownDto {
  currencyBase: 'IRR';
  displayCurrency: 'TOMAN';
  role: 'BARBER' | 'SERVICE';
  isServiceStaff: boolean;

  grossAmount: string;
  shopShareAmount: string;
  employeeShareAmount: string;
  tipAmount: string;
  teamTipAmount: string;
  deductionAmount: string;
  paidAmount: string;
  /** Appointment-only withdrawable for BARBER; tip net for SERVICE. */
  finalAmount: string;
  /** Admin direct-settlement total when present (Policy B). Optional for old snapshots. */
  settlementPayable?: string;

  appointmentCount: number;
  serviceCount: number;
  tipAllocationCount: number;
  commissionPercentageUsed: number;

  breakdownItems: SalaryBreakdownItemDto[];
}

/** Minimal preview fields needed to build a breakdown (from live preview or snapshotJson). */
export interface SalaryPreviewLike {
  totalAppointments?: number;
  totalRevenue?: string | number | null;
  employeeShare?: string | number | null;
  platformShare?: string | number | null;
  totalDeduction?: string | number | null;
  priorWithdrawalsTotal?: string | number | null;
  netPayable?: string | number | null;
  /** Optional: absent on historical snapshots predating Policy B. */
  settlementPayable?: string | number | null;
  commissionPercentageUsed?: number | null;
  isServiceStaff?: boolean;
  totalTipIncome?: string | number | null;
  tipAllocationCount?: number | null;
  teamShareIncome?: string | number | null;
}

function asIrrString(value: string | number | bigint | null | undefined): string {
  if (value == null) return '0';
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    return Math.trunc(value).toString();
  }
  const cleaned = String(value).trim().replace(/,/g, '');
  if (!cleaned || cleaned === 'NaN') return '0';
  try {
    return BigInt(cleaned).toString();
  } catch {
    const n = Number(cleaned);
    return Number.isFinite(n) ? Math.trunc(n).toString() : '0';
  }
}

/**
 * Build a stable breakdown DTO from the shared payroll preview result.
 * Does not recompute payroll — only reshapes existing preview fields.
 */
export function buildSalaryBreakdownFromPreview(
  preview: SalaryPreviewLike,
): SalaryBreakdownDto {
  const isServiceStaff = Boolean(preview.isServiceStaff);

  if (isServiceStaff) {
    const tipAmount = asIrrString(preview.totalTipIncome || preview.employeeShare);
    const paidAmount = asIrrString(preview.priorWithdrawalsTotal);
    const finalAmount = asIrrString(preview.netPayable);
    const tipCount = preview.tipAllocationCount ?? 0;

    const breakdownItems: SalaryBreakdownItemDto[] = [
      {
        key: 'tip',
        label: 'انعام / سهم خدمات',
        amount: tipAmount,
        description: 'مجموع انعام‌های تخصیص‌یافته به شما در بازه',
      },
      {
        key: 'paid',
        label: 'پرداخت‌شده قبلی',
        amount: paidAmount,
        description: 'برداشت‌ها / پرداخت‌های قبلی در همین بازه',
      },
      {
        key: 'final',
        label:
          BigInt(finalAmount) < 0n
            ? 'بدهی قابل تسویه (منفی)'
            : 'مبلغ نهایی قابل برداشت',
        amount: finalAmount,
        description:
          BigInt(finalAmount) < 0n
            ? 'مبلغ منفی یعنی بدهی/بیش‌برداشت — بدون صفر کردن ذخیره و نمایش می‌شود'
            : 'انعام منهای پرداخت‌های قبلی',
      },
    ];

    return {
      currencyBase: 'IRR',
      displayCurrency: 'TOMAN',
      role: 'SERVICE',
      isServiceStaff: true,
      grossAmount: tipAmount,
      shopShareAmount: '0',
      employeeShareAmount: tipAmount,
      tipAmount,
      teamTipAmount: '0',
      deductionAmount: '0',
      paidAmount,
      finalAmount,
      appointmentCount: 0,
      serviceCount: tipCount,
      tipAllocationCount: tipCount,
      commissionPercentageUsed: 0,
      breakdownItems,
    };
  }

  const grossAmount = asIrrString(preview.totalRevenue);
  const shopShareAmount = asIrrString(preview.platformShare);
  const employeeShareAmount = asIrrString(preview.employeeShare);
  const teamTipAmount = asIrrString(preview.teamShareIncome);
  const tipAmount = '0';
  const deductionAmount = asIrrString(preview.totalDeduction);
  const paidAmount = asIrrString(preview.priorWithdrawalsTotal);
  // Policy B: finalAmount = appointment-only netPayable (TEAM tips NOT included).
  // Historical snapshots may still store tip-inclusive netPayable — render stored value as-is.
  const finalAmount = asIrrString(preview.netPayable);
  // Only expose settlementPayable when present on the preview (live Policy B / new snapshots).
  // Do NOT derive as final+tips — that double-counts legacy tip-inclusive netPayable snapshots.
  const settlementPayable =
    preview.settlementPayable != null && preview.settlementPayable !== ''
      ? asIrrString(preview.settlementPayable)
      : undefined;
  const pct = preview.commissionPercentageUsed ?? 0;
  const appointmentCount = preview.totalAppointments ?? 0;

  const breakdownItems: SalaryBreakdownItemDto[] = [
    {
      key: 'gross',
      label: 'جمع کل کارکرد',
      amount: grossAmount,
      description: 'مجموع مبلغ نوبت‌های تسویه‌شده در بازه',
    },
    {
      key: 'shop_share',
      label: 'سهم آرایشگاه',
      amount: shopShareAmount,
      description: `سهم سالن از کارکرد (${Math.max(0, 100 - pct)}٪)`,
    },
    {
      key: 'employee_share',
      label: 'سهم شما',
      amount: employeeShareAmount,
      description: `سهم کمیسیون شما (${pct}٪) قبل از کسورات`,
    },
    {
      key: 'team_tip',
      label: 'سهم انعام تیمی',
      amount: teamTipAmount,
      description:
        'برای آرایشگر همیشه صفر است؛ انعام فقط به پرسنل خدمات تعلق می‌گیرد',
    },
    {
      key: 'deduction',
      label: 'کسورات (مالیات سهم شما)',
      amount: deductionAmount,
      description: `مالیات سهم آرایشگر هر نوبت × ${appointmentCount} (مالیات سالن از حقوق کسر نمی‌شود)`,
    },
    {
      key: 'paid',
      label: 'پرداخت‌شده قبلی',
      amount: paidAmount,
      description: 'برداشت‌ها / پرداخت‌های قبلی در همین بازه',
    },
    {
      key: 'final',
      label:
        BigInt(finalAmount) < 0n
          ? 'بدهی قابل تسویه (منفی)'
          : 'قابل برداشت از سهم نوبت‌ها',
      amount: finalAmount,
      description:
        BigInt(finalAmount) < 0n
          ? 'مبلغ منفی یعنی بدهی/بیش‌برداشت — بدون صفر کردن ذخیره و نمایش می‌شود'
          : 'سهم نوبت‌ها − کسورات − پرداخت‌های قبلی',
    },
  ];

  // Informational admin settlement total only when it differs from final (legacy/SERVICE paths).
  // For current barbers, settlementPayable === netPayable and team tips are always 0.
  if (
    settlementPayable != null &&
    BigInt(teamTipAmount) > 0n &&
    settlementPayable !== finalAmount
  ) {
    breakdownItems.push({
      key: 'admin_settlement',
      label: 'جمع تسویه مستقیم با سهم تیمی',
      amount: settlementPayable,
      description:
        'فقط برای تسویه مستقیم ادمین؛ در درخواست حقوق کارمند قابل درخواست نیست',
    });
  }

  return {
    currencyBase: 'IRR',
    displayCurrency: 'TOMAN',
    role: 'BARBER',
    isServiceStaff: false,
    grossAmount,
    shopShareAmount,
    employeeShareAmount,
    tipAmount,
    teamTipAmount,
    deductionAmount,
    paidAmount,
    finalAmount,
    ...(settlementPayable != null ? { settlementPayable } : {}),
    appointmentCount,
    serviceCount: appointmentCount,
    tipAllocationCount: preview.tipAllocationCount ?? 0,
    commissionPercentageUsed: pct,
    breakdownItems,
  };
}

/**
 * Rebuild breakdown from a stored salary-request snapshotJson when possible.
 */
export function buildSalaryBreakdownFromSnapshot(
  snapshot: unknown,
  fallbacks?: {
    requestedAmountRial?: string;
    availableAtRequestRial?: string;
  },
): SalaryBreakdownDto | null {
  if (!snapshot || typeof snapshot !== 'object') {
    if (!fallbacks) return null;
    const finalAmount = asIrrString(
      fallbacks.requestedAmountRial ?? fallbacks.availableAtRequestRial ?? '0',
    );
    return {
      currencyBase: 'IRR',
      displayCurrency: 'TOMAN',
      role: 'BARBER',
      isServiceStaff: false,
      grossAmount: '0',
      shopShareAmount: '0',
      employeeShareAmount: '0',
      tipAmount: '0',
      teamTipAmount: '0',
      deductionAmount: '0',
      paidAmount: '0',
      finalAmount,
      appointmentCount: 0,
      serviceCount: 0,
      tipAllocationCount: 0,
      commissionPercentageUsed: 0,
      breakdownItems: [
        {
          key: 'final',
          label: 'مبلغ نهایی',
          amount: finalAmount,
        },
      ],
    };
  }

  return buildSalaryBreakdownFromPreview(snapshot as SalaryPreviewLike);
}
