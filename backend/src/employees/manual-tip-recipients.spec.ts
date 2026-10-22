import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import {
  assertManualTipRecipient,
  isReservedSettleManualTipKey,
  manualTipAllowsService,
} from '../appointments/manual-settlement-tip';

describe('manual tip recipients', () => {
  const findMany = jest.fn();
  const service = new EmployeesService({ employee: { findMany } } as never);

  const rows = [
    { id: 1, isActive: true, user: { name: 'Barber', role: 'EMPLOYEE' } },
    { id: 2, isActive: true, user: { name: 'Service', role: 'SERVICE' } },
  ];

  beforeEach(() => {
    findMany.mockReset();
  });

  it('always queries active EMPLOYEE and SERVICE (env flag ignored)', async () => {
    findMany.mockResolvedValue(rows);
    const previous = process.env.MANUAL_TIP_ALLOW_SERVICE;
    try {
      delete process.env.MANUAL_TIP_ALLOW_SERVICE;
      const result = await service.findManualTipRecipients();
      expect(findMany.mock.calls[0][0].where).toEqual({
        isActive: true,
        user: { role: { in: ['EMPLOYEE', 'SERVICE'] } },
      });
      expect(result.map((r) => r.role)).toEqual(['EMPLOYEE', 'SERVICE']);
    } finally {
      if (previous === undefined) delete process.env.MANUAL_TIP_ALLOW_SERVICE;
      else process.env.MANUAL_TIP_ALLOW_SERVICE = previous;
    }
  });

  it('deprecated MANUAL_TIP_ALLOW_SERVICE helper always returns true', () => {
    expect(manualTipAllowsService({} as NodeJS.ProcessEnv)).toBe(true);
    expect(manualTipAllowsService({ MANUAL_TIP_ALLOW_SERVICE: 'false' } as NodeJS.ProcessEnv)).toBe(
      true,
    );
  });

  it('endpoint is open to ADMIN and ACCOUNTANT only (settle roles)', () => {
    const roles = Reflect.getMetadata('roles', EmployeesController.prototype.findManualTipRecipients);
    expect(roles).toEqual(['ADMIN', 'ACCOUNTANT']);
    const path = Reflect.getMetadata('path', EmployeesController.prototype.findManualTipRecipients);
    expect(path).toBe('tip-recipients/manual');
  });

  it.each([
    ['ADMIN', true],
    ['ACCOUNTANT', true],
    ['EMPLOYEE', false],
    ['SERVICE', false],
    ['CUSTOMER', false],
  ])('PermissionGuard on GET /employees/tip-recipients/manual: %s -> %s', (role, allowed) => {
    expect(Reflect.getMetadata('__guards__', EmployeesController)).toEqual([JwtAuthGuard, PermissionGuard]);
    const guard = new PermissionGuard(new Reflector());
    const context = {
      getHandler: () => EmployeesController.prototype.findManualTipRecipients,
      getClass: () => EmployeesController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext;
    expect(guard.canActivate(context)).toBe(allowed);
  });

  it('assertManualTipRecipient accepts EMPLOYEE or SERVICE', () => {
    expect(() => assertManualTipRecipient('EMPLOYEE')).not.toThrow();
    expect(() => assertManualTipRecipient('SERVICE')).not.toThrow();
    expect(() => assertManualTipRecipient('CUSTOMER')).toThrow(BadRequestException);
    expect(() => assertManualTipRecipient(null)).toThrow(BadRequestException);
  });

  it('reserves settle-manual-tip:{id} keys', () => {
    expect(isReservedSettleManualTipKey('settle-manual-tip:41')).toBe(true);
    expect(isReservedSettleManualTipKey('settle-manual-tip:abc')).toBe(false);
    expect(isReservedSettleManualTipKey('admin-tip-1')).toBe(false);
  });
});
