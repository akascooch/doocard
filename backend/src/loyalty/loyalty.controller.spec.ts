import 'reflect-metadata';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { LoyaltyAdminController } from './loyalty.admin.controller';
import { LoyaltyController } from './loyalty.controller';

describe('Loyalty controllers auth', () => {
  it('customer loyalty is JWT + PermissionGuard and CUSTOMER-only', () => {
    const guards = Reflect.getMetadata('__guards__', LoyaltyController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionGuard]));
    expect(Reflect.getMetadata('roles', LoyaltyController.prototype.me)).toEqual(['CUSTOMER']);
    expect(Reflect.getMetadata('roles', LoyaltyController.prototype.redeem)).toEqual(['CUSTOMER']);
  });

  it('admin adjust-points is ADMIN-only', () => {
    const guards = Reflect.getMetadata('__guards__', LoyaltyAdminController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionGuard]));
    expect(Reflect.getMetadata('roles', LoyaltyAdminController.prototype.adjust)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata('roles', LoyaltyAdminController.prototype.getSettings)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata('roles', LoyaltyAdminController.prototype.updateSettings)).toEqual(['ADMIN']);
  });
});
