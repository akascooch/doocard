/**
 * Per-appointment tax split (legacy documentation):
 * - Salon tax: 120,000 تومان
 * - Barber tax: 80,000 تومان
 * - Total tax: 200,000 تومان
 *
 * Active payroll policies (Phase 1):
 * - DEFAULT: (amount × 40%) − 80,000 تومان
 * - SPECIAL (`Employee.isSpecialCommission`): (amount − 200,000 تومان) × 50%
 *
 * Amounts in SPECIAL_COMMISSION_POLICY / DEFAULT_COMMISSION_POLICY are تومان.
 * Convert with TOMAN_TO_RIAL before applying to IRR appointment amounts.
 */
export const SALON_APPOINTMENT_TAX_TOMAN = 120_000;
export const BARBER_APPOINTMENT_TAX_TOMAN = 80_000;

/** @deprecated Use BARBER_APPOINTMENT_TAX_TOMAN — alias kept for call sites */
export const BARBER_APPOINTMENT_DEDUCTION_TOMAN = BARBER_APPOINTMENT_TAX_TOMAN;

export const TOMAN_TO_RIAL = 10;
export const BARBER_APPOINTMENT_DEDUCTION_RIAL =
  BARBER_APPOINTMENT_DEDUCTION_TOMAN * TOMAN_TO_RIAL;
export const SALON_APPOINTMENT_TAX_RIAL = SALON_APPOINTMENT_TAX_TOMAN * TOMAN_TO_RIAL;
export const BARBER_APPOINTMENT_TAX_RIAL = BARBER_APPOINTMENT_TAX_TOMAN * TOMAN_TO_RIAL;

export type CommissionPolicy = {
  /** Tax deduction per appointment, in تومان. */
  taxDeduction: number;
  /** Employee split as a fraction (0–1). */
  split: number;
};

/** Special barbers: tax-first then equal split. */
export const SPECIAL_COMMISSION_POLICY: CommissionPolicy = {
  taxDeduction: 200_000,
  split: 0.5,
};

/** Default barbers: share-first then barber tax. */
export const DEFAULT_COMMISSION_POLICY: CommissionPolicy = {
  taxDeduction: 80_000,
  split: 0.4,
};

export const DEFAULT_COMMISSION_PERCENTAGE = Math.round(
  DEFAULT_COMMISSION_POLICY.split * 100,
);

export function commissionPolicyTaxRial(policy: CommissionPolicy): bigint {
  return BigInt(policy.taxDeduction) * BigInt(TOMAN_TO_RIAL);
}

export function commissionPolicySplitPercent(policy: CommissionPolicy): number {
  return Math.round(policy.split * 100);
}

/**
 * Per-appointment commission math.
 * - Special: netShare = (amount − 200k) × 50%  (tax may exceed amount → negative netShare)
 * - Default: netShare = (amount × split%) − 80k
 */
export function computeAppointmentCommissionShare(
  amountRial: bigint,
  isSpecialCommission: boolean,
  /** Default-policy only: optional UI override of split percent (0–100). */
  splitPercentOverride?: number,
): {
  taxAppliedRial: bigint;
  /** Share before subtracting tax (default); for special equals after-tax base × split. */
  grossShareRial: bigint;
  netShareRial: bigint;
  splitPercentUsed: number;
  isSpecialCommission: boolean;
} {
  if (isSpecialCommission) {
    const taxAppliedRial = commissionPolicyTaxRial(SPECIAL_COMMISSION_POLICY);
    const splitPercentUsed = commissionPolicySplitPercent(SPECIAL_COMMISSION_POLICY);
    const afterTax = amountRial - taxAppliedRial;
    const netShareRial =
      (afterTax * BigInt(Math.floor(splitPercentUsed * 100))) / 10000n;
    return {
      taxAppliedRial,
      grossShareRial: netShareRial,
      netShareRial,
      splitPercentUsed,
      isSpecialCommission: true,
    };
  }

  const taxAppliedRial = commissionPolicyTaxRial(DEFAULT_COMMISSION_POLICY);
  const defaultPct = commissionPolicySplitPercent(DEFAULT_COMMISSION_POLICY);
  const splitPercentUsed =
    splitPercentOverride !== undefined && !Number.isNaN(splitPercentOverride)
      ? Math.max(0, Math.min(100, splitPercentOverride))
      : defaultPct;
  const grossShareRial =
    (amountRial * BigInt(Math.floor(splitPercentUsed * 100))) / 10000n;
  const netShareRial = grossShareRial - taxAppliedRial;
  return {
    taxAppliedRial,
    grossShareRial,
    netShareRial,
    splitPercentUsed,
    isSpecialCommission: false,
  };
}

export const EMPLOYEE_EXPENSE_CATEGORY_CODES = [
  'EMPLOYEE_WITHDRAWAL',
  'COMMISSION_SETTLEMENT',
  'SALARY_ADVANCE',
  'PAYROLL',
] as const;

export const COMMISSION_SETTLEMENT_SOURCE_TYPE = 'COMMISSION_SETTLEMENT';
export const SALARY_REQUEST_SOURCE_TYPE = 'SALARY_REQUEST';
export const CHEQUE_LEAF_PAYROLL_SOURCE_TYPE = 'CHEQUE_LEAF_PAYROLL';
export const EMPLOYEE_WITHDRAWAL_CATEGORY_CODE = 'EMPLOYEE_WITHDRAWAL';

/** Live local DB canonical payroll ledger category (برداشت ها (حقوق)). */
export const CANONICAL_EMPLOYEE_WITHDRAWAL_CATEGORY_ID = 10;
