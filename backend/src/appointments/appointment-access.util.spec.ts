import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  APPOINTMENT_NOT_FOUND_FA,
  EMPLOYEE_ACCESS_DENIED_FA,
  actorUserId,
  assertCustomerOwnsAppointment,
  assertEmployeeNotImpersonating,
  assertEmployeeOwnsAppointment,
  isAdminLikeRole,
  isEmployeeRole,
  scopedEmployeeListId,
} from './appointment-access.util';

describe('appointment-access.util', () => {
  it('reads actor id from id, then sub, then userId', () => {
    expect(actorUserId({ id: 7 })).toBe(7);
    expect(actorUserId({ sub: 8 })).toBe(8);
    expect(actorUserId({ userId: 9 })).toBe(9);
    expect(actorUserId({ id: 7, sub: 8 })).toBe(7);
    expect(actorUserId({})).toBeUndefined();
    expect(actorUserId({ id: 'x' })).toBeUndefined();
  });

  it('classifies employee vs admin-like', () => {
    expect(isEmployeeRole({ role: 'EMPLOYEE' })).toBe(true);
    expect(isEmployeeRole({ role: 'ADMIN' })).toBe(false);
    expect(isAdminLikeRole({ role: 'ADMIN' })).toBe(true);
    expect(isAdminLikeRole({ role: 'ACCOUNTANT' })).toBe(true);
    expect(isAdminLikeRole({ role: 'EMPLOYEE' })).toBe(false);
  });

  it('allows omitted or matching client employeeId and rejects a foreign id', () => {
    expect(() => assertEmployeeNotImpersonating(undefined, 4)).not.toThrow();
    expect(() => assertEmployeeNotImpersonating(null, 4)).not.toThrow();
    expect(() => assertEmployeeNotImpersonating(4, 4)).not.toThrow();
    try {
      assertEmployeeNotImpersonating(9, 4);
      fail('expected ForbiddenException');
    } catch (err) {
      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).message).toBe(EMPLOYEE_ACCESS_DENIED_FA);
      expect((err as ForbiddenException).message).not.toMatch(/9|آرایشگر دیگر/);
    }
  });

  it('scopes list queries to the authenticated employee and rejects foreign query ids', () => {
    expect(scopedEmployeeListId(4, undefined)).toBe(4);
    expect(scopedEmployeeListId(4, 4)).toBe(4);
    expect(() => scopedEmployeeListId(4, 11)).toThrow(ForbiddenException);
  });

  it('hides foreign appointments behind a generic 404', () => {
    expect(() => assertEmployeeOwnsAppointment(4, 4)).not.toThrow();
    try {
      assertEmployeeOwnsAppointment(4, 11);
      fail('expected NotFoundException');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundException);
      expect((err as NotFoundException).message).toBe(APPOINTMENT_NOT_FOUND_FA);
    }
    expect(() => assertEmployeeOwnsAppointment(4, null)).toThrow(NotFoundException);
    expect(() => assertCustomerOwnsAppointment(3, 99)).toThrow(NotFoundException);
    expect(() => assertCustomerOwnsAppointment(3, 3)).not.toThrow();
  });
});
