import { BadRequestException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { EmployeeSalaryRequestService } from './employee-salary-request.service';
import { jalaliRangeToTehranClosed } from '../common/utils/tehran-business-day';

describe('listMyWithdrawals date bounds [R3]', () => {
  const prisma = {
    employee: { findUnique: jest.fn() },
    transaction: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  let service: EmployeeSalaryRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.employee.findUnique.mockResolvedValue({
      id: 7,
      user: { role: 'EMPLOYEE' },
    });
    prisma.transaction.findMany.mockResolvedValue([]);
    prisma.transaction.count.mockResolvedValue(0);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: 0n } });

    service = new EmployeeSalaryRequestService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('filters EXPENSE rows on occurredAt gte/lte of the Jalali closed range', async () => {
    const from = '1403/06/01';
    const to = '1403/06/16';
    const expected = jalaliRangeToTehranClosed(from, to);
    expect(expected).not.toBeNull();

    await service.listMyWithdrawals(50, 1, 20, from, to);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          type: TransactionType.EXPENSE,
          employeeId: 7,
          occurredAt: { gte: expected!.start, lte: expected!.endInclusive },
        },
        orderBy: { occurredAt: 'desc' },
      }),
    );
  });

  it('rejects one-sided from/to', async () => {
    await expect(service.listMyWithdrawals(50, 1, 20, '1403/06/01', undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('omits occurredAt when neither from nor to is provided', async () => {
    await service.listMyWithdrawals(50, 1, 20);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          type: TransactionType.EXPENSE,
          employeeId: 7,
        },
      }),
    );
    const where = prisma.transaction.findMany.mock.calls[0][0].where;
    expect(where.occurredAt).toBeUndefined();
  });
});
