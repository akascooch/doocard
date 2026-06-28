import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  TransactionType,
} from '@prisma/client';
import { calculateEmployeeSalaryPreview } from './employee-salary.service';
import { BARBER_APPOINTMENT_DEDUCTION_RIAL } from '../common/constants/employee-commission.constants';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const defaults = {
    employee: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        commissionRate: 40,
        lastCommissionSettlementAt: null,
        user: { name: 'Test Barber', role: 'EMPLOYEE' },
      }),
    },
    employeeCommissionSettlement: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    employeeCommissionSettlementAppointment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    employeeCommissionSettlementTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    appointment: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 10,
          amount: 10_000_000n,
          scheduledAt: new Date('2024-06-15T06:30:00.000Z'),
          status: AppointmentStatus.COMPLETED,
          customer: { user: { name: 'Customer A' } },
        },
        {
          id: 11,
          amount: 5_000_000n,
          scheduledAt: new Date('2024-06-16T06:30:00.000Z'),
          status: AppointmentStatus.SETTLED,
          customer: { user: { name: 'Customer B' } },
        },
      ]),
      count: jest.fn().mockResolvedValue(0),
    },
    transactionCategory: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    salary: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    transaction: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 99,
          type: TransactionType.EXPENSE,
          amount: 1_000_000n,
          occurredAt: new Date('2024-06-10T06:30:00.000Z'),
          description: 'برداشت',
          category: { name: 'برداشت کارمند' },
          sourceType: 'MANUAL',
        },
        {
          id: 100,
          type: TransactionType.TIP,
          amount: 2_000_000n,
          occurredAt: new Date('2024-06-11T06:30:00.000Z'),
          description: 'tip',
          category: null,
          sourceType: 'TIP',
        },
      ]),
    },
  };

  return { ...defaults, ...overrides } as any;
}

describe('calculateEmployeeSalaryPreview', () => {
  it('excludes TIP transactions from withdrawals and uses appointment amount not tipAmount', async () => {
    const prisma = mockPrisma();

    const result = await calculateEmployeeSalaryPreview(prisma, {
      employeeId: 1,
      fromJalali: '1403/03/01',
      toJalali: '1403/03/31',
      percentage: 40,
    });

    expect(result.totalAppointments).toBe(2);
    expect(result.totalRevenue).toBe('15000000');

    const grossShare = (15_000_000 * 40) / 100;
    expect(result.employeeShare).toBe(String(grossShare));

    const totalDeduction = 2 * BARBER_APPOINTMENT_DEDUCTION_RIAL;
    expect(result.totalDeduction).toBe(String(totalDeduction));

    expect(result.priorWithdrawalsTotal).toBe('1000000');
    expect(result.priorWithdrawals).toHaveLength(1);
    expect(result.priorWithdrawals[0].id).toBe(99);

    const netAfterDeduction = grossShare - totalDeduction;
    expect(result.payoutNetAfterDeduction).toBe(String(netAfterDeduction));
    expect(result.netPayable).toBe(String(netAfterDeduction - 1_000_000));
    expect(result.appointments).toHaveLength(2);
    expect(result.appointments[0].amountRial).toBe('10000000');
    expect(result.appointments[0].customerName).toBe('Customer A');
  });

  it('throws when employee not found', async () => {
    const prisma = mockPrisma({
      employee: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(
      calculateEmployeeSalaryPreview(prisma, {
        employeeId: 999,
        fromJalali: '1403/03/01',
        toJalali: '1403/03/31',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('uses default 40% commission when employee rate is zero', async () => {
    const prisma = mockPrisma({
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          commissionRate: 0,
          lastCommissionSettlementAt: null,
          user: { name: 'X', role: 'EMPLOYEE' },
        }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            amount: 10_000_000n,
            scheduledAt: new Date('2024-06-15T06:30:00.000Z'),
            status: AppointmentStatus.COMPLETED,
            customer: { user: { name: 'Customer' } },
          },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await calculateEmployeeSalaryPreview(prisma, {
      employeeId: 1,
      fromJalali: '1403/03/15',
      toJalali: '1403/03/15',
    });

    expect(result.commissionPercentageUsed).toBe(40);
    expect(result.employeeShare).toBe('4000000');
  });
});
