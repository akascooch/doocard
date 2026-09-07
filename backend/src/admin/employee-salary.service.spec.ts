import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AppointmentStatus,
  EmployeeCommissionSettlementStatus,
  TransactionType,
} from '@prisma/client';
import {
  calculateEmployeeSalaryPreview,
  EmployeeSalaryService,
} from './employee-salary.service';
import {
  BARBER_APPOINTMENT_DEDUCTION_RIAL,
  commissionPolicyTaxRial,
  DEFAULT_COMMISSION_POLICY,
  SPECIAL_COMMISSION_POLICY,
} from '../common/constants/employee-commission.constants';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const defaults = {
    employee: {
      findUnique: jest.fn().mockResolvedValue({
        id: 1,
        commissionRate: 40,
        isSpecialCommission: false,
        lastCommissionSettlementAt: null,
        user: { name: 'Test Barber', role: 'EMPLOYEE' },
      }),
    },
    employeeCommissionSettlement: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    employeeCommissionSettlementAppointment: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    employeeCommissionSettlementTransaction: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
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
      update: jest.fn(),
    },
    appointmentTipAllocation: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    manualTipAllocation: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
    },
    transactionCategory: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    salary: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    bankAccount: {
      findFirst: jest.fn().mockResolvedValue({ id: 1, deletedAt: null }),
      update: jest.fn(),
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
      create: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(defaults)),
  };

  return { ...defaults, ...overrides } as any;
}

describe('calculateEmployeeSalaryPreview', () => {
  it('DEFAULT: (amount × 40%) − 80k per appointment; taxApplied/netShare on rows', async () => {
    const prisma = mockPrisma();

    const result = await calculateEmployeeSalaryPreview(prisma, {
      employeeId: 1,
      fromJalali: '1403/03/01',
      toJalali: '1403/03/31',
      percentage: 40,
    });

    expect(result.isSpecialCommission).toBe(false);
    expect(result.totalAppointments).toBe(2);
    expect(result.totalRevenue).toBe('15000000');

    const grossShare = (15_000_000 * 40) / 100;
    expect(result.employeeShare).toBe(String(grossShare));

    const totalDeduction = 2 * BARBER_APPOINTMENT_DEDUCTION_RIAL;
    expect(result.totalDeduction).toBe(String(totalDeduction));
    expect(result.deductionPerAppointmentAmount).toBe(
      String(commissionPolicyTaxRial(DEFAULT_COMMISSION_POLICY)),
    );

    expect(result.priorWithdrawalsTotal).toBe('1000000');
    expect(result.priorWithdrawals).toHaveLength(1);

    const netAfterDeduction = grossShare - totalDeduction;
    expect(result.payoutNetAfterDeduction).toBe(String(netAfterDeduction));
    expect(result.netPayable).toBe(String(netAfterDeduction - 1_000_000));
    expect(result.settlementPayable).toBe(result.netPayable);

    expect(result.appointments).toHaveLength(2);
    // 10_000_000 * 40% = 4_000_000; tax 800_000 → netShare 3_200_000
    expect(result.appointments[0].taxApplied).toBe('800000');
    expect(result.appointments[0].netShare).toBe('3200000');
    // 5_000_000 * 40% = 2_000_000; tax 800_000 → netShare 1_200_000
    expect(result.appointments[1].taxApplied).toBe('800000');
    expect(result.appointments[1].netShare).toBe('1200000');

    const withdrawalWhere = prisma.transaction.findMany.mock.calls[0][0].where;
    expect(withdrawalWhere.occurredAt).toEqual(
      expect.objectContaining({
        gt: expect.any(Date),
        lte: expect.any(Date),
      }),
    );
    expect(withdrawalWhere.occurredAt).not.toHaveProperty('gte');
  });

  it('SPECIAL: amount > 200k → ((amount − 200k) × 50%)', async () => {
    const amount = 30_000_000n; // 3_000_000 تومان
    const prisma = mockPrisma({
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: 4,
          commissionRate: 40,
          isSpecialCommission: true,
          lastCommissionSettlementAt: null,
          user: { name: 'Special Barber', role: 'EMPLOYEE' },
        }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 20,
            amount,
            scheduledAt: new Date('2024-06-15T06:30:00.000Z'),
            status: AppointmentStatus.SETTLED,
            customer: { user: { name: 'C' } },
          },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await calculateEmployeeSalaryPreview(prisma, {
      employeeId: 4,
      fromJalali: '1403/03/15',
      toJalali: '1403/03/15',
      percentage: 40, // ignored for special
    });

    const tax = commissionPolicyTaxRial(SPECIAL_COMMISSION_POLICY); // 2_000_000 rial
    const netShare = ((amount - tax) * 50n) / 100n;

    expect(result.isSpecialCommission).toBe(true);
    expect(result.commissionPercentageUsed).toBe(50);
    expect(result.totalDeduction).toBe(tax.toString());
    expect(result.deductionPerAppointmentAmount).toBe(tax.toString());
    expect(result.appointments[0].taxApplied).toBe(tax.toString());
    expect(result.appointments[0].netShare).toBe(netShare.toString());
    expect(result.payoutNetAfterDeduction).toBe(netShare.toString());
    expect(result.netPayable).toBe(netShare.toString());
    expect(result.employeeShare).toBe(netShare.toString());
    // Shop gets the other 50% of after-tax
    expect(result.platformShare).toBe(netShare.toString());
  });

  it('SPECIAL: amount < 200k → negative netShare is preserved (not clamped)', async () => {
    const amount = 1_000_000n; // 100_000 تومان < 200_000 tax
    const prisma = mockPrisma({
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: 3,
          commissionRate: 0,
          isSpecialCommission: true,
          lastCommissionSettlementAt: null,
          user: { name: 'Special Low', role: 'EMPLOYEE' },
        }),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            amount,
            scheduledAt: new Date('2024-06-15T06:30:00.000Z'),
            status: AppointmentStatus.SETTLED,
            customer: { user: { name: 'C' } },
          },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await calculateEmployeeSalaryPreview(prisma, {
      employeeId: 3,
      fromJalali: '1403/03/15',
      toJalali: '1403/03/15',
    });

    const tax = 2_000_000n;
    const netShare = ((amount - tax) * 50n) / 100n; // -500_000
    expect(netShare < 0n).toBe(true);
    expect(result.appointments[0].taxApplied).toBe(tax.toString());
    expect(result.appointments[0].netShare).toBe(netShare.toString());
    expect(result.netPayable).toBe(netShare.toString());
    expect(BigInt(result.netPayable) < 0n).toBe(true);
  });

  it('BARBER: TEAM tip allocations are ignored; settlementPayable equals netPayable', async () => {
    const prisma = mockPrisma({
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 10,
            amount: 30_250_000n,
            scheduledAt: new Date('2024-06-15T06:30:00.000Z'),
            status: AppointmentStatus.COMPLETED,
            customer: { user: { name: 'A' } },
          },
          {
            id: 11,
            amount: 30_250_000n,
            scheduledAt: new Date('2024-06-15T07:30:00.000Z'),
            status: AppointmentStatus.COMPLETED,
            customer: { user: { name: 'B' } },
          },
          {
            id: 12,
            amount: 30_250_000n,
            scheduledAt: new Date('2024-06-15T08:30:00.000Z'),
            status: AppointmentStatus.SETTLED,
            customer: { user: { name: 'C' } },
          },
          {
            id: 13,
            amount: 30_250_000n,
            scheduledAt: new Date('2024-06-15T09:30:00.000Z'),
            status: AppointmentStatus.SETTLED,
            customer: { user: { name: 'D' } },
          },
        ]),
        count: jest.fn().mockResolvedValue(0),
      },
      appointmentTipAllocation: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, amountRial: 2_250_000n },
          { id: 2, amountRial: 2_250_000n },
        ]),
      },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await calculateEmployeeSalaryPreview(prisma, {
      employeeId: 1,
      fromJalali: '1403/03/15',
      toJalali: '1403/03/15',
      percentage: 40,
    });

    // 121_000_000 * 40% = 48_400_000; deduction 800_000 * 4 = 3_200_000 → 45_200_000
    expect(result.totalRevenue).toBe('121000000');
    expect(result.employeeShare).toBe('48400000');
    expect(result.totalDeduction).toBe(String(4 * BARBER_APPOINTMENT_DEDUCTION_RIAL));
    expect(result.payoutNetAfterDeduction).toBe('45200000');
    expect(result.teamShareIncome).toBe('0');
    expect(result.tipAllocationCount).toBe(0);
    expect(result.netPayable).toBe('45200000');
    expect(result.settlementPayable).toBe('45200000');
  });

  it('BARBER: prior withdrawals reduce netPayable; TEAM tips remain zero', async () => {
    const prisma = mockPrisma({
      appointmentTipAllocation: {
        findMany: jest.fn().mockResolvedValue([{ id: 1, amountRial: 4_500_000n }]),
      },
    });

    const result = await calculateEmployeeSalaryPreview(prisma, {
      employeeId: 1,
      fromJalali: '1403/03/01',
      toJalali: '1403/03/31',
      percentage: 40,
    });

    const grossShare = (15_000_000 * 40) / 100;
    const netAfterDeduction = grossShare - 2 * BARBER_APPOINTMENT_DEDUCTION_RIAL;
    expect(result.priorWithdrawalsTotal).toBe('1000000');
    expect(result.teamShareIncome).toBe('0');
    expect(result.netPayable).toBe(String(netAfterDeduction - 1_000_000));
    expect(result.settlementPayable).toBe(result.netPayable);
  });

  it('SERVICE: settlementPayable equals netPayable (no double-count of tips)', async () => {
    const paidAt = new Date('2024-06-15T10:00:00.000Z');
    const prisma = mockPrisma({
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7,
          commissionRate: 0,
          isSpecialCommission: false,
          lastCommissionSettlementAt: null,
          user: { name: 'Service Staff', role: 'SERVICE' },
        }),
      },
      appointmentTipAllocation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 101,
            amountRial: 500_000n,
            appointment: {
              id: 501,
              paidAt,
              scheduledAt: paidAt,
              tipAmount: 500_000n,
              tipRecipientType: 'INDIVIDUAL',
              employeeId: 3,
              employee: { id: 3, user: { name: 'مجید محبوب' } },
              customer: { user: { name: 'مشتری ۱' } },
              appointmentServices: [{ service: { name: 'اصلاح' } }],
              service: null,
            },
          },
          {
            id: 102,
            amountRial: 250_000n,
            appointment: {
              id: 502,
              paidAt,
              scheduledAt: paidAt,
              tipAmount: 1_000_000n,
              tipRecipientType: 'TEAM',
              employeeId: 3,
              employee: { id: 3, user: { name: 'مجید محبوب' } },
              customer: { user: { name: 'مشتری ۲' } },
              appointmentServices: [],
              service: { name: 'رنگ' },
            },
          },
        ]),
      },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await calculateEmployeeSalaryPreview(prisma, {
      employeeId: 7,
      fromJalali: '1403/03/01',
      toJalali: '1403/03/31',
    });

    expect(result.isServiceStaff).toBe(true);
    expect(result.isSpecialCommission).toBe(false);
    expect(result.totalTipIncome).toBe('750000');
    expect(result.tipAllocationCount).toBe(2);
    expect(result.tipLines).toHaveLength(2);
    expect(result.netPayable).toBe('750000');
    expect(result.settlementPayable).toBe(result.netPayable);
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
          isSpecialCommission: false,
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
    expect(result.settlementPayable).toBe(result.netPayable);
  });
});

describe('EmployeeSalaryService.commitSettlement — negative payable', () => {
  it('persists negative settlement without throwing and without bank expense', async () => {
    const settlementCreate = jest.fn().mockResolvedValue({
      id: 501,
      netPayableRial: -500_000n,
    });
    const settlementUpdate = jest.fn();
    const aptCreate = jest.fn();
    const aptUpdate = jest.fn();
    const txCreate = jest.fn();
    const bankUpdate = jest.fn();
    const linkCreate = jest.fn();
    const employeeUpdate = jest.fn();

    const tx = {
      employeeCommissionSettlement: {
        create: settlementCreate,
        update: settlementUpdate,
      },
      employeeCommissionSettlementAppointment: { create: aptCreate },
      employeeCommissionSettlementTransaction: { create: linkCreate },
      appointment: { update: aptUpdate },
      appointmentTipAllocation: { updateMany: jest.fn() },
      manualTipAllocation: { updateMany: jest.fn() },
      transaction: { create: txCreate },
      bankAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, deletedAt: null }),
        update: bankUpdate,
      },
      employee: { update: employeeUpdate },
    };

    // amount 1_000_000 rial with special → netShare -500_000; no withdrawals
    const prisma = mockPrisma({
      employee: {
        findUnique: jest.fn().mockResolvedValue({
          id: 3,
          commissionRate: 0,
          isSpecialCommission: true,
          lastCommissionSettlementAt: null,
          user: { name: 'Special Low', role: 'EMPLOYEE' },
        }),
        update: employeeUpdate,
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            amount: 1_000_000n,
            scheduledAt: new Date('2024-06-15T06:30:00.000Z'),
            status: AppointmentStatus.SETTLED,
            customer: { user: { name: 'C' } },
          },
        ]),
        count: jest.fn().mockResolvedValue(0),
        update: aptUpdate,
      },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
      employeeCommissionSettlement: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: settlementCreate,
        update: settlementUpdate,
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (fn: (client: unknown) => Promise<unknown>) =>
        fn(tx),
      ),
    });

    const service = new EmployeeSalaryService(prisma);
    const result = await service.commitSettlement(
      {
        employeeId: 3,
        fromJalali: '1403/03/15',
        toJalali: '1403/03/15',
        commissionPercentage: 50,
        periodStartConfirmed: true,
        bankAccountId: 1,
      },
      99,
    );

    expect(BigInt(result.settlementPayable) < 0n).toBe(true);
    expect(result.settlementPayable).toBe('-500000');
    expect(settlementCreate).toHaveBeenCalled();
    const createArg = settlementCreate.mock.calls[0][0];
    expect(createArg.data.netPayableRial).toBe(-500000n);
    // Negative → no bank expense transaction
    expect(txCreate).not.toHaveBeenCalled();
    expect(bankUpdate).not.toHaveBeenCalled();
    expect(result.settlementTransactionId).toBeNull();
  });

  it('still rejects barber commit with zero appointments', async () => {
    const prisma = mockPrisma({
      appointment: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      transaction: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const service = new EmployeeSalaryService(prisma);

    await expect(
      service.commitSettlement(
        {
          employeeId: 1,
          fromJalali: '1403/03/15',
          toJalali: '1403/03/15',
          commissionPercentage: 40,
          periodStartConfirmed: true,
          bankAccountId: 1,
        },
        99,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
