export const LOTTERY_CONTRIBUTION_SOURCE_TYPE = 'LOTTERY_CONTRIBUTION';
export const LOTTERY_PAYOUT_SOURCE_TYPE = 'LOTTERY_PAYOUT';
/** Payroll-linked monthly loan installment (employee repayment). */
export const EMPLOYEE_LOAN_INSTALLMENT_SOURCE_TYPE = 'EMPLOYEE_LOAN_INSTALLMENT';
export const LOTTERY_SOURCE_TYPES = [
  LOTTERY_CONTRIBUTION_SOURCE_TYPE,
  LOTTERY_PAYOUT_SOURCE_TYPE,
  EMPLOYEE_LOAN_INSTALLMENT_SOURCE_TYPE,
] as const;

export function loanInstallmentIdempotencyKey(
  groupId: number,
  employeeId: number,
  periodKey: string,
): string {
  return `loan:installment:${groupId}:${employeeId}:${periodKey}`;
}

export const MAIN_TILL_ACCOUNT_NAME = 'حساب صندوق';

export function contribIdempotencyKey(
  groupId: number,
  cycleId: number,
  periodKey: string,
  memberId: number,
): string {
  return `lottery:contrib:${groupId}:${cycleId}:${periodKey}:${memberId}`;
}

export function payoutIdempotencyKey(
  groupId: number,
  cycleId: number,
  periodKey: string,
): string {
  return `lottery:payout:${groupId}:${cycleId}:${periodKey}`;
}

export function prepaidIdempotencyKey(memberId: number, clientKey: string): string {
  return `lottery:prepaid:${memberId}:${clientKey}`;
}

export function addMonthsYm(periodKey: string, add: number): string {
  const [y, m] = periodKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + add;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}
