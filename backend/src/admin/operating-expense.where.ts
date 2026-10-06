import { Prisma } from '@prisma/client';
import {
  CHEQUE_LEAF_PAYROLL_SOURCE_TYPE,
  COMMISSION_SETTLEMENT_SOURCE_TYPE,
  EMPLOYEE_EXPENSE_CATEGORY_CODES,
  SALARY_REQUEST_SOURCE_TYPE,
} from '../common/constants/employee-commission.constants';

/** Staff wage / withdrawal ledger rows. Operating cheques are not in this list. */
export const STAFF_WAGE_EXPENSE_SOURCE_TYPES = [
  CHEQUE_LEAF_PAYROLL_SOURCE_TYPE,
  SALARY_REQUEST_SOURCE_TYPE,
  COMMISSION_SETTLEMENT_SOURCE_TYPE,
] as const;

/**
 * Yearly expense chart predicate.
 * Excludes staff withdrawals identified by sourceType or category code.
 * Does not exclude CHEQUE_LEAF operating expenses or rows with a null category.
 * Does not use a hardcoded category id.
 */
export function operatingExpenseWhere(
  start: Date,
  end: Date,
): Prisma.TransactionWhereInput {
  return {
    type: 'EXPENSE',
    deletedAt: null,
    occurredAt: { gte: start, lte: end },
    NOT: {
      OR: [
        { sourceType: { in: [...STAFF_WAGE_EXPENSE_SOURCE_TYPES] } },
        {
          category: {
            code: { in: [...EMPLOYEE_EXPENSE_CATEGORY_CODES] },
          },
        },
      ],
    },
  };
}
