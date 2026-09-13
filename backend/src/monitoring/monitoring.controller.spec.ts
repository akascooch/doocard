import 'reflect-metadata';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { MonitoringController } from './monitoring.controller';

const METHODS = ['getMetrics', 'getSystemHealth', 'resetMetrics', 'getStatus'] as const;

describe('MonitoringController auth', () => {
  it('applies JwtAuthGuard and PermissionGuard at class level', () => {
    const guards = Reflect.getMetadata('__guards__', MonitoringController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PermissionGuard]));
  });

  it.each(METHODS)('%s requires ADMIN', (method) => {
    const roles = Reflect.getMetadata(
      'roles',
      MonitoringController.prototype[method],
    ) as string[] | undefined;
    expect(roles).toEqual(expect.arrayContaining(['ADMIN']));
  });
});
