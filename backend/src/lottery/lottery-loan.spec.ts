import { BadRequestException } from '@nestjs/common';
import {
  LotteryGroupStatus,
  LotteryMemberStatus,
  Prisma,
  TransactionType,
} from '@prisma/client';
import { LotteryService } from './lottery.service';
import { EMPLOYEE_LOAN_INSTALLMENT_SOURCE_TYPE } from '../common/constants/lottery.constants';

describe('LotteryService loan installments', () => {
  const prisma = {
    lotteryGroup: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    lotteryMember: {
      findMany: jest.fn(),
    },
    lotteryLoanInstallmentEvent: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    transaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const service = new LotteryService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
  });

  it('applies monthly loan installments idempotently via unique installment events', async () => {
    prisma.lotteryGroup.findUnique.mockResolvedValue({
      id: 3,
      name: 'وام آبان',
      status: LotteryGroupStatus.ACTIVE,
      circleAccountId: null,
      monthlyAmountRial: 1_000_000n,
      startPeriodYm: '2026-11',
    });
    prisma.lotteryMember.findMany.mockResolvedValue([
      {
        id: 10,
        employeeId: 4,
        status: LotteryMemberStatus.ACTIVE,
        employee: { user: { name: 'Ali' } },
      },
    ]);
    prisma.lotteryLoanInstallmentEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 1,
        amountRial: 1_000_000n,
        transactionId: 77,
      });
    prisma.lotteryLoanInstallmentEvent.create.mockResolvedValue({
      id: 1,
      amountRial: 1_000_000n,
    });
    prisma.lotteryLoanInstallmentEvent.update.mockResolvedValue({
      id: 1,
      transactionId: 77,
    });
    prisma.transaction.create.mockResolvedValue({
      id: 77,
      amount: 1_000_000n,
    });

    const first = await service.applyMonthInstallments(
      3,
      { periodKey: '2026-11', confirm: true },
      1,
    );
    expect(first.appliedCount).toBe(1);
    expect(prisma.lotteryLoanInstallmentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupId: 3,
          employeeId: 4,
          periodKey: '2026-11',
          idempotencyKey: 'loan:installment:3:4:2026-11',
          amountRial: 1_000_000n,
        }),
      }),
    );
    expect(prisma.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: TransactionType.EXPENSE,
          sourceType: EMPLOYEE_LOAN_INSTALLMENT_SOURCE_TYPE,
          employeeId: 4,
          amount: 1_000_000n,
        }),
      }),
    );

    const second = await service.applyMonthInstallments(
      3,
      { periodKey: '2026-11', confirm: true },
      1,
    );
    expect(second.alreadyAppliedCount).toBe(1);
    expect(prisma.transaction.create).toHaveBeenCalledTimes(1);
    expect(prisma.lotteryLoanInstallmentEvent.create).toHaveBeenCalledTimes(1);
  });

  it('maps a uniqueness race (P2002) to ALREADY_APPLIED without creating a second ledger row', async () => {
    prisma.lotteryGroup.findUnique.mockResolvedValue({
      id: 3,
      name: 'وام آبان',
      status: LotteryGroupStatus.ACTIVE,
      circleAccountId: null,
      monthlyAmountRial: 1_000_000n,
      startPeriodYm: '2026-11',
    });
    prisma.lotteryMember.findMany.mockResolvedValue([
      {
        id: 10,
        employeeId: 4,
        status: LotteryMemberStatus.ACTIVE,
        employee: { user: { name: 'Ali' } },
      },
    ]);
    prisma.lotteryLoanInstallmentEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 9,
        amountRial: 1_000_000n,
        transactionId: 55,
      });
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['groupId', 'employeeId', 'periodKey'] },
      }),
    );

    const result = await service.applyMonthInstallments(
      3,
      { periodKey: '2026-11', confirm: true },
      1,
    );

    expect(result.appliedCount).toBe(0);
    expect(result.alreadyAppliedCount).toBe(1);
    expect(result.results[0]).toEqual(
      expect.objectContaining({
        employeeId: 4,
        status: 'ALREADY_APPLIED',
        transactionId: 55,
      }),
    );
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('refuses apply without confirm and for circle-account groups', async () => {
    await expect(
      service.applyMonthInstallments(1, { confirm: false }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.lotteryGroup.findUnique.mockResolvedValue({
      id: 2,
      status: LotteryGroupStatus.ACTIVE,
      circleAccountId: 9,
      monthlyAmountRial: 1n,
    });
    await expect(
      service.applyMonthInstallments(2, { confirm: true }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
