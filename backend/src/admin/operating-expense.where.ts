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

export function payrollWithdrawalExclusion(): Prisma.TransactionWhereInput {
  return {
    OR: [
      { sourceType: { in: [...PAYROLL_WITHDRAWAL_SOURCE_TYPES] } },
      {
        category: {
          code: { in: [...PAYROLL_WITHDRAWAL_CATEGORY_CODES] },
        },
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
