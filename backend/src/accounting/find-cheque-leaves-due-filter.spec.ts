import { BadRequestException } from '@nestjs/common';
import { AccountingService } from './accounting.service';

describe('AccountingService.findAllChequeLeaves dueDate filter', () => {
  const prisma = {
    chequeLeaf: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
  };

  let service: AccountingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AccountingService(
      prisma as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  it('omits dueDate from where when no range is set', async () => {
    await service.findAllChequeLeaves({ status: 'ISSUED' as any, take: 10 });
    const where = prisma.chequeLeaf.findMany.mock.calls[0][0].where;
    expect(where).toEqual({ deletedAt: null, status: 'ISSUED' });
    expect(where.dueDate).toBeUndefined();
  });

  it('applies dueFrom/dueTo with not-null exclusion and keeps pagination', async () => {
    await service.findAllChequeLeaves({
      chequebookId: 7,
      dueFrom: '2026-10-01',
      dueTo: '2026-10-31',
      skip: 20,
      take: 50,
    } as any);

    const args = prisma.chequeLeaf.findMany.mock.calls[0][0];
    expect(args.skip).toBe(20);
    expect(args.take).toBe(50);
    expect(args.where.chequebookId).toBe(7);
    expect(args.where.dueDate.not).toBeNull();
    expect(args.where.dueDate.gte).toBeInstanceOf(Date);
    expect(args.where.dueDate.lte).toBeInstanceOf(Date);
    expect(args.where.dueDate.gte.getTime()).toBeLessThanOrEqual(
      args.where.dueDate.lte.getTime(),
    );
  });

  it('rejects inverted dueFrom > dueTo with 400', async () => {
    await expect(
      service.findAllChequeLeaves({
        dueFrom: '2026-10-31',
        dueTo: '2026-10-01',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.chequeLeaf.findMany).not.toHaveBeenCalled();
  });
});
