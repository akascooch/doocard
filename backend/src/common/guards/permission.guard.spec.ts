import 'reflect-metadata';
import { Controller, ExecutionContext, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { Roles } from '../decorators/roles.decorator';
import { ImportController } from '../../import/import.controller';
import { SmsAdminController } from '../../sms/sms-admin.controller';

@Controller('open')
class OpenController {
  @Get()
  anyAuthenticated() {
    return true;
  }
}

@Controller('class-locked')
@Roles('ADMIN')
class ClassLockedController {
  @Get()
  fromClass() {
    return true;
  }

  @Get('customer')
  @Roles('CUSTOMER')
  overridden() {
    return true;
  }
}

@Controller('handler-only')
class HandlerOnlyController {
  @Get()
  @Roles('EMPLOYEE')
  employeeOnly() {
    return true;
  }
}

function contextFor(
  handler: (...args: unknown[]) => unknown,
  cls: new (...args: unknown[]) => unknown,
  user?: { role?: string },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionGuard', () => {
  const guard = new PermissionGuard(new Reflector());
  const deniedRoles = ['CUSTOMER', 'EMPLOYEE', 'SERVICE', 'ACCOUNTANT', 'MANAGER'];

  it('allows any authenticated user when neither handler nor class declares roles', () => {
    expect(
      guard.canActivate(
        contextFor(OpenController.prototype.anyAuthenticated, OpenController, {
          role: 'CUSTOMER',
        }),
      ),
    ).toBe(true);
  });

  it('allows a request with no user when no role metadata is present', () => {
    expect(
      guard.canActivate(
        contextFor(OpenController.prototype.anyAuthenticated, OpenController, undefined),
      ),
    ).toBe(true);
  });

  it('enforces handler-level roles', () => {
    const ctx = (role?: string) =>
      contextFor(HandlerOnlyController.prototype.employeeOnly, HandlerOnlyController, role ? { role } : undefined);
    expect(guard.canActivate(ctx('EMPLOYEE'))).toBe(true);
    expect(guard.canActivate(ctx('ADMIN'))).toBe(false);
    expect(guard.canActivate(ctx())).toBe(false);
  });

  it('enforces class-level roles when the handler has none', () => {
    const ctx = (role?: string) =>
      contextFor(ClassLockedController.prototype.fromClass, ClassLockedController, role ? { role } : undefined);
    expect(guard.canActivate(ctx('ADMIN'))).toBe(true);
    expect(guard.canActivate(ctx('CUSTOMER'))).toBe(false);
    expect(guard.canActivate(ctx())).toBe(false);
  });

  it('lets handler metadata override class metadata', () => {
    const ctx = (role: string) =>
      contextFor(ClassLockedController.prototype.overridden, ClassLockedController, { role });
    expect(guard.canActivate(ctx('CUSTOMER'))).toBe(true);
    expect(guard.canActivate(ctx('ADMIN'))).toBe(false);
  });

  it.each([
    ['downloadCustomersTemplate', ImportController.prototype.downloadCustomersTemplate],
    ['upload', ImportController.prototype.upload],
    ['commit', ImportController.prototype.commit],
    ['getJobs', ImportController.prototype.getJobs],
    ['getJob', ImportController.prototype.getJob],
  ])('requires ADMIN on import %s', (_name, handler) => {
    expect(
      guard.canActivate(contextFor(handler, ImportController, { role: 'ADMIN' })),
    ).toBe(true);
    for (const role of deniedRoles) {
      expect(guard.canActivate(contextFor(handler, ImportController, { role }))).toBe(false);
    }
    expect(guard.canActivate(contextFor(handler, ImportController, undefined))).toBe(false);
  });

  it.each([
    ['getStatus', SmsAdminController.prototype.getStatus],
    ['listRules', SmsAdminController.prototype.listRules],
    ['updateRule', SmsAdminController.prototype.updateRule],
    ['listTemplates', SmsAdminController.prototype.listTemplates],
    ['catalog', SmsAdminController.prototype.catalog],
    ['getTemplate', SmsAdminController.prototype.getTemplate],
    ['updateTemplate', SmsAdminController.prototype.updateTemplate],
    ['listEvents', SmsAdminController.prototype.listEvents],
    ['eventsByAppointment', SmsAdminController.prototype.eventsByAppointment],
    ['sendTest', SmsAdminController.prototype.sendTest],
    ['sendCustom', SmsAdminController.prototype.sendCustom],
  ])('requires ADMIN on sms admin %s', (_name, handler) => {
    expect(
      guard.canActivate(contextFor(handler, SmsAdminController, { role: 'ADMIN' })),
    ).toBe(true);
    for (const role of deniedRoles) {
      expect(guard.canActivate(contextFor(handler, SmsAdminController, { role }))).toBe(false);
    }
    expect(guard.canActivate(contextFor(handler, SmsAdminController, undefined))).toBe(false);
  });
});
