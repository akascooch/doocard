import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EmployeeSalaryController } from './employee-salary.controller';
import { EmployeeSalaryRequestService } from './employee-salary-request.service';
import { assertFixedSalaryWithdrawalBlocked } from '../common/constants/staff-roles';

describe('pending salary request access', () => {
  it('exposes destinationNote and keeps the list admin/accountant only', async () => {
    const reflector = new Reflector();
    const roles = reflector.get<string[]>('roles', EmployeeSalaryController.prototype.listRequests);
    expect(roles).toEqual(['ADMIN', 'ACCOUNTANT']);
    for (const denied of ['EMPLOYEE', 'SERVICE', 'KITCHEN', 'CASHIER', 'CUSTOMER']) {
      expect(roles).not.toContain(denied);
    }

    const prisma = {
      employeeSalaryRequest: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 3,
            requestedAmountRial: 1000n,
            availableAtRequestRial: 2000n,
            destinationNote: 'IR120000000000000000000000',
            snapshotJson: {},
            employee: { user: { id: 1, name: 'Staff', role: 'EMPLOYEE' } },
          },
        ]),
      },
    };
    const service = new EmployeeSalaryRequestService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const rows = await service.listAdmin();
    expect(rows[0].destinationNote).toBe('IR120000000000000000000000');
    expect(JSON.stringify(rows[0])).toContain('IR120000000000000000000000');
  });

  it('blocks kitchen and cashier withdrawals without inventing a balance', () => {
    expect(() => assertFixedSalaryWithdrawalBlocked('KITCHEN')).toThrow(BadRequestException);
    expect(() => assertFixedSalaryWithdrawalBlocked('CASHIER')).toThrow(BadRequestException);
    expect(() => assertFixedSalaryWithdrawalBlocked('EMPLOYEE')).not.toThrow();
    expect(() => assertFixedSalaryWithdrawalBlocked('SERVICE')).not.toThrow();
  });
});
