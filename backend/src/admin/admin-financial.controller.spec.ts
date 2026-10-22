import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { FinancialReportsAccessGuard } from '../common/guards/financial-reports-access.guard';
import { AdminFinancialController } from './admin-financial.controller';

describe('AdminFinancialController', () => {
  it('locks yearly-report and expenses behind JWT, permission, ADMIN, and financial token', () => {
    const classGuards = Reflect.getMetadata('__guards__', AdminFinancialController) as unknown[];
    expect(classGuards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionGuard]));
    expect(Reflect.getMetadata('roles', AdminFinancialController.prototype.getYearlyReport)).toEqual([
      'ADMIN',
    ]);
    expect(Reflect.getMetadata('roles', AdminFinancialController.prototype.getExpenses)).toEqual([
      'ADMIN',
    ]);
    expect(Reflect.getMetadata('__guards__', AdminFinancialController.prototype.getYearlyReport)).toEqual(
      expect.arrayContaining([FinancialReportsAccessGuard]),
    );
    expect(Reflect.getMetadata('__guards__', AdminFinancialController.prototype.getExpenses)).toEqual(
      expect.arrayContaining([FinancialReportsAccessGuard]),
    );
  });

  it('returns 403 without x-financial-access-token', async () => {
    const guard = new FinancialReportsAccessGuard({
      validateAccessToken: jest.fn(),
    } as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 1 },
          headers: {},
        }),
      }),
    };
    await expect(guard.canActivate(ctx as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
