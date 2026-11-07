import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

/** Roles that need an Employee row for the existing salary-request lookup. */
export function requiresEmployeeProfile(role?: string | null): boolean {
  return (
    role === UserRole.EMPLOYEE ||
    role === UserRole.SERVICE ||
    role === UserRole.KITCHEN ||
    role === UserRole.CASHIER
  );
}

/** Kitchen and cashier. No commission formula and no service-staff tip payroll. */
export function isFixedSalaryRole(role?: string | null): boolean {
  return role === UserRole.KITCHEN || role === UserRole.CASHIER;
}

export function canOpenSalaryRequest(role?: string | null): boolean {
  return requiresEmployeeProfile(role);
}

export const FIXED_SALARY_POLICY_UNAVAILABLE =
  'سیاست حقوق ثابت برای نقش آشپزخانه یا صندوقدار تعریف نشده است. مبلغی محاسبه نمی‌شود و درخواست برداشت ثبت نمی‌شود.';

export function assertFixedSalaryWithdrawalBlocked(role?: string | null): void {
  if (isFixedSalaryRole(role)) {
    throw new BadRequestException(FIXED_SALARY_POLICY_UNAVAILABLE);
  }
}
