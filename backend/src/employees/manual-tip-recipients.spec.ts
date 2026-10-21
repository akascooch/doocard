import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import {
  assertManualTipRecipient,
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

  it('flag off: queries only active EMPLOYEE barbers', async () => {
    findMany.mockResolvedValue([rows[0]]);

    const result = await service.findManualTipRecipients(false);

    expect(findMany.mock.calls[0][0].where).toEqual({
      isActive: true,
      user: { role: { in: ['EMPLOYEE'] } },
    });
    expect(result).toEqual([{ id: 1, fullName: 'Barber', role: 'EMPLOYEE', isActive: true }]);
  });

  it('flag on: includes active SERVICE staff', async () => {
    findMany.mockResolvedValue(rows);

    const result = await service.findManualTipRecipients(true);

    expect(findMany.mock.calls[0][0].where.user.role.in).toEqual(['EMPLOYEE', 'SERVICE']);
    expect(result.map((r) => r.role)).toEqual(['EMPLOYEE', 'SERVICE']);
  });

  it('reads MANUAL_TIP_ALLOW_SERVICE only when exactly "true"', () => {
    expect(manualTipAllowsService({ MANUAL_TIP_ALLOW_SERVICE: 'true' } as NodeJS.ProcessEnv)).toBe(true);
    expect(manualTipAllowsService({ MANUAL_TIP_ALLOW_SERVICE: '1' } as NodeJS.ProcessEnv)).toBe(false);
    expect(manualTipAllowsService({} as NodeJS.ProcessEnv)).toBe(false);
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

  it('controller follows MANUAL_TIP_ALLOW_SERVICE from env (off -> EMPLOYEE only, on -> + SERVICE)', async () => {
    const controller = new EmployeesController(service);
    const previous = process.env.MANUAL_TIP_ALLOW_SERVICE;
    try {
      delete process.env.MANUAL_TIP_ALLOW_SERVICE;
      findMany.mockResolvedValue([rows[0]]);
      await controller.findManualTipRecipients();
      expect(findMany.mock.calls[0][0].where.user.role.in).toEqual(['EMPLOYEE']);

      process.env.MANUAL_TIP_ALLOW_SERVICE = 'true';
      findMany.mockResolvedValue(rows);
      const result = await controller.findManualTipRecipients();
      expect(findMany.mock.calls[1][0].where.user.role.in).toEqual(['EMPLOYEE', 'SERVICE']);
      expect(Object.keys(result[0]).sort()).toEqual(['fullName', 'id', 'isActive', 'role']);
    } finally {
      if (previous === undefined) delete process.env.MANUAL_TIP_ALLOW_SERVICE;
      else process.env.MANUAL_TIP_ALLOW_SERVICE = previous;
    }
  });

  it('assertManualTipRecipient accepts SERVICE only when allowed', () => {
    expect(() => assertManualTipRecipient('EMPLOYEE', false)).not.toThrow();
    expect(() => assertManualTipRecipient('SERVICE', false)).toThrow(BadRequestException);
    expect(() => assertManualTipRecipient('SERVICE', true)).not.toThrow();
    expect(() => assertManualTipRecipient('CUSTOMER', true)).toThrow(BadRequestException);
    expect(() => assertManualTipRecipient(null, true)).toThrow(BadRequestException);
  });
});
