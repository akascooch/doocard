import 'reflect-metadata';
import { LotteryAdminController, LotteryStaffController } from './lottery.controller';

describe('Lottery controllers RBAC', () => {
  it('ACCOUNTANT can list and dry-run but cannot run', () => {
    expect(Reflect.getMetadata('roles', LotteryAdminController.prototype.listGroups)).toEqual([
      'ADMIN',
      'ACCOUNTANT',
    ]);
    expect(Reflect.getMetadata('roles', LotteryAdminController.prototype.dryRun)).toEqual([
      'ADMIN',
      'ACCOUNTANT',
    ]);
    expect(Reflect.getMetadata('roles', LotteryAdminController.prototype.run)).toEqual(['ADMIN']);
    expect(Reflect.getMetadata('roles', LotteryAdminController.prototype.createGroup)).toEqual(['ADMIN']);
  });

  it('staff /lottery/me is EMPLOYEE+SERVICE only', () => {
    expect(Reflect.getMetadata('roles', LotteryStaffController.prototype.me)).toEqual([
      'EMPLOYEE',
      'SERVICE',
    ]);
    expect(Reflect.getMetadata('path', LotteryStaffController)).toBe('lottery');
  });
});
