import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { AdminPersonalController } from './admin-personal.controller';

const METHODS = [
  'getTodayFrog',
  'frogHistory',
  'upsertFrog',
  'toggleFrog',
  'expenseSummary',
  'listExpenses',
  'createExpense',
  'deleteExpense',
] as const;

describe('AdminPersonalController auth', () => {
  it('applies JwtAuthGuard and PermissionGuard at class level', () => {
    const guards = Reflect.getMetadata('__guards__', AdminPersonalController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionGuard]));
  });

  it.each(METHODS)('%s requires ADMIN', (method) => {
    const roles = Reflect.getMetadata(
      'roles',
      AdminPersonalController.prototype[method],
    ) as string[] | undefined;
    expect(roles).toEqual(['ADMIN']);
  });

  it.each(['EMPLOYEE', 'CUSTOMER', 'ACCOUNTANT', 'SERVICE'] as const)(
    'PermissionGuard denies %s on getTodayFrog',
    (role) => {
      const guard = new PermissionGuard(new Reflector());
      const context = {
        getHandler: () => AdminPersonalController.prototype.getTodayFrog,
        getClass: () => AdminPersonalController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 1, role } }),
        }),
      } as unknown as ExecutionContext;
      expect(guard.canActivate(context)).toBe(false);
    },
  );

  it('PermissionGuard allows ADMIN on getTodayFrog', () => {
    const guard = new PermissionGuard(new Reflector());
    const context = {
      getHandler: () => AdminPersonalController.prototype.getTodayFrog,
      getClass: () => AdminPersonalController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { id: 1, role: 'ADMIN' } }),
      }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(true);
  });
});
