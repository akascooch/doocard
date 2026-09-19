import 'reflect-metadata';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PackagesController } from './packages.controller';

const ADMIN_METHODS = ['listTemplates', 'createTemplate', 'updateTemplate', 'deactivateTemplate'] as const;
const STAFF_METHODS = ['assign', 'consume', 'listAssigned', 'eligible', 'eligibleBatch', 'loyaltyEligible'] as const;

describe('PackagesController auth', () => {
  it('applies JwtAuthGuard and PermissionGuard at class level', () => {
    const guards = Reflect.getMetadata('__guards__', PackagesController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionGuard]));
  });

  it.each(ADMIN_METHODS)('%s requires ADMIN', (method) => {
    expect(Reflect.getMetadata('roles', PackagesController.prototype[method])).toEqual(['ADMIN']);
  });

  it.each(STAFF_METHODS)('%s allows staff roles', (method) => {
    expect(Reflect.getMetadata('roles', PackagesController.prototype[method])).toEqual(
      expect.arrayContaining(['ADMIN', 'EMPLOYEE', 'SERVICE']),
    );
  });

  it('myPackages requires CUSTOMER', () => {
    expect(Reflect.getMetadata('roles', PackagesController.prototype.myPackages)).toEqual(['CUSTOMER']);
  });
});
