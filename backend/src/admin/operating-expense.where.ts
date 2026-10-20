import { Prisma } from '@prisma/client';
import {
  CHEQUE_LEAF_PAYROLL_SOURCE_TYPE,
  COMMISSION_SETTLEMENT_SOURCE_TYPE,
  EMPLOYEE_EXPENSE_CATEGORY_CODES,
  EMPLOYEE_WITHDRAWAL_LEGACY_CATEGORY_CODE,
  SALARY_REQUEST_SOURCE_TYPE,
} from '../common/constants/employee-commission.constants';

/**
 * Staff-pay markers only. Operating cheques stay (`CHEQUE_LEAF` is absent).
 * Import sources are not excluded as a whole; a row drops only when it
 * carries one of these source types or category codes.
 */
export const PAYROLL_WITHDRAWAL_SOURCE_TYPES = [
  CHEQUE_LEAF_PAYROLL_SOURCE_TYPE,
  SALARY_REQUEST_SOURCE_TYPE,
  COMMISSION_SETTLEMENT_SOURCE_TYPE,
] as const;

export const PAYROLL_WITHDRAWAL_CATEGORY_CODES = [
  ...EMPLOYEE_EXPENSE_CATEGORY_CODES,
  EMPLOYEE_WITHDRAWAL_LEGACY_CATEGORY_CODE,
] as const;

export const UNCATEGORIZED_EXPENSE_LABEL = 'بدون دسته‌بندی';
export const OPERATING_CHEQUE_SOURCE_TYPE = 'CHEQUE_LEAF';

export type OperatingExpenseFixture = {
  type: string;
  deletedAt?: Date | null;
  sourceType?: string | null;
  categoryCode?: string | null;
  chequeCategory?: 'NORMAL' | 'GUARANTEE' | null;
};

/** Same inclusion rules as accountingExpenseWhere, for fixture tests. */
export function isOperatingExpense(row: OperatingExpenseFixture): boolean {
  if (row.type !== 'EXPENSE' || row.deletedAt) return false;
  if (
    row.sourceType &&
    (PAYROLL_WITHDRAWAL_SOURCE_TYPES as readonly string[]).includes(row.sourceType)
  ) {
    return false;
  }
  if (
    row.categoryCode &&
    (PAYROLL_WITHDRAWAL_CATEGORY_CODES as readonly string[]).includes(row.categoryCode)
  ) {
    return false;
  }
  if (row.sourceType === OPERATING_CHEQUE_SOURCE_TYPE && row.chequeCategory === 'GUARANTEE') {
    return false;
  }
  return true;
}

export function isClearedOperatingCheque(row: OperatingExpenseFixture): boolean {
  return isOperatingExpense(row) && row.sourceType === OPERATING_CHEQUE_SOURCE_TYPE;
}

/**
 * Cheque amount is a subset of the operating total, never an extra series.
 * other + cheques === total.
 */
export function splitExpenseChart(total: bigint, cheques: bigint): {
  total: bigint;
  other: bigint;
  cheques: bigint;
} {
  const safeTotal = total > 0n ? total : 0n;
  const bounded = cheques < 0n ? 0n : cheques > safeTotal ? safeTotal : cheques;
  return { total: safeTotal, other: safeTotal - bounded, cheques: bounded };
}

export function payrollWithdrawalExclusion(): Prisma.TransactionWhereInput {
  return {
    OR: [
      { sourceType: { in: [...PAYROLL_WITHDRAWAL_SOURCE_TYPES] } },
      {
        category: {
          code: { in: [...PAYROLL_WITHDRAWAL_CATEGORY_CODES] },
        },
      },
      {
        sourceType: OPERATING_CHEQUE_SOURCE_TYPE,
        chequeLeaves: { some: { category: 'GUARANTEE' } },
      },
    ],
  };
}

/** Expense rows inside an inclusive window, minus payroll withdrawals. */
export function operatingExpenseWhere(
  start: Date,
  end: Date,
): Prisma.TransactionWhereInput {
  return accountingExpenseWhere(start, end);
}

/**
 * Same exclusion as the yearly chart. Dates are optional so the accounting
 * period summary can share the predicate when from/to are omitted.
 */
export function accountingExpenseWhere(
  from?: Date,
  to?: Date,
): Prisma.TransactionWhereInput {
  const occurredAt: Prisma.DateTimeFilter = {};
  if (from) occurredAt.gte = from;
  if (to) occurredAt.lte = to;
  return {
    type: 'EXPENSE',
    deletedAt: null,
    ...(from || to ? { occurredAt } : {}),
    NOT: payrollWithdrawalExclusion(),
  };
}
