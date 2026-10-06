import { Prisma } from '@prisma/client';
import {
  CHEQUE_LEAF_PAYROLL_SOURCE_TYPE,
  EMPLOYEE_WITHDRAWAL_CATEGORY_CODE,
  SALARY_REQUEST_SOURCE_TYPE,
} from '../common/constants/employee-commission.constants';

/**
 * Payroll / employee-withdrawal markers only.
 * CHEQUE_LEAF (operating cheque, no staff marker) is not in this list.
 * Commission, salary-advance, and generic payroll category codes are not
 * excluded as whole categories — a row is dropped only when it carries one
 * of these markers.
 */
export const PAYROLL_WITHDRAWAL_SOURCE_TYPES = [
  CHEQUE_LEAF_PAYROLL_SOURCE_TYPE,
  SALARY_REQUEST_SOURCE_TYPE,
] as const;

export const PAYROLL_WITHDRAWAL_CATEGORY_CODES = [
  EMPLOYEE_WITHDRAWAL_CATEGORY_CODE,
] as const;

export const UNCATEGORIZED_EXPENSE_LABEL = 'سایر';

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
