import { ForbiddenException, NotFoundException } from '@nestjs/common';

/** Generic — do not name another employee or confirm that a foreign appointment exists. */
export const EMPLOYEE_ACCESS_DENIED_FA = 'دسترسی به این نوبت مجاز نیست';
export const EMPLOYEE_PROFILE_MISSING_FA = 'پروفایل آرایشگر یافت نشد';
export const APPOINTMENT_NOT_FOUND_FA = 'نوبت یافت نشد';

export type ActorUser = {
  id?: unknown;
  sub?: unknown;
  userId?: unknown;
  role?: string;
} | null | undefined;

export function actorUserId(user: ActorUser): number | undefined {
  const raw = user?.id ?? user?.sub ?? user?.userId;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function isEmployeeRole(user: ActorUser): boolean {
  return user?.role === 'EMPLOYEE';
}

export function isCustomerRole(user: ActorUser): boolean {
  return user?.role === 'CUSTOMER';
}

export function isAdminLikeRole(user: ActorUser): boolean {
  return user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT';
}

/**
 * Client-supplied employeeId is ignored when omitted or matching.
 * A conflicting id is treated as an impersonation attempt (403).
 */
export function assertEmployeeNotImpersonating(
  clientEmployeeId: number | null | undefined,
  authenticatedEmployeeId: number,
): void {
  if (clientEmployeeId == null) return;
  if (Number(clientEmployeeId) !== authenticatedEmployeeId) {
    throw new ForbiddenException(EMPLOYEE_ACCESS_DENIED_FA);
  }
}

export function scopedEmployeeListId(
  authenticatedEmployeeId: number,
  queryEmployeeId?: number | null,
): number {
  if (queryEmployeeId != null && Number(queryEmployeeId) !== authenticatedEmployeeId) {
    throw new ForbiddenException(EMPLOYEE_ACCESS_DENIED_FA);
  }
  return authenticatedEmployeeId;
}

/** 404 hides whether another employee's appointment exists. */
export function assertEmployeeOwnsAppointment(
  authenticatedEmployeeId: number,
  appointmentEmployeeId: number | null | undefined,
): void {
  if (appointmentEmployeeId !== authenticatedEmployeeId) {
    throw new NotFoundException(APPOINTMENT_NOT_FOUND_FA);
  }
}

export function assertCustomerOwnsAppointment(
  authenticatedCustomerId: number,
  appointmentCustomerId: number | null | undefined,
): void {
  if (appointmentCustomerId !== authenticatedCustomerId) {
    throw new NotFoundException(APPOINTMENT_NOT_FOUND_FA);
  }
}
