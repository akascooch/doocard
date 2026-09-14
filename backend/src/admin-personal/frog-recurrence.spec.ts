import { Prisma } from '@prisma/client';
import { AdminPersonalService } from './admin-personal.service';
import { FrogRecurrenceScheduler } from './frog-recurrence.scheduler';

function dailyRec(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    userId: 4,
    title: 'تمرکز صبح',
    description: null,
    frequency: 'DAILY',
    dayOfWeek: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('frog-recurrence scheduler idempotency (v2.0.7)', () => {
  const prisma = {
    adminFrogRecurrence: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    adminDailyFrog: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const service = new AdminPersonalService(prisma as never);
  const at = new Date('2026-09-14T12:00:00.000+03:30');

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminFrogRecurrence.updateMany.mockResolvedValue({ count: 1 });
    prisma.adminDailyFrog.create.mockResolvedValue({ id: 'frog-1' });
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
  });

  it('creates at most one frog per user per Tehran day even with two matching recurrences', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([
      dailyRec(),
      dailyRec({ id: 'r2', title: 'الگوی دوم', createdAt: new Date('2026-01-02T00:00:00.000Z') }),
    ]);
    prisma.adminDailyFrog.findUnique.mockResolvedValue(null);

    const first = await service.applyDueRecurrences(at);
    expect(first).toMatchObject({ today: '2026-09-14', created: 1, skipped: 0 });
    expect(prisma.adminDailyFrog.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminDailyFrog.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ userId: 4, dateKey: '2026-09-14', title: 'تمرکز صبح' }),
    );

    prisma.adminDailyFrog.findUnique.mockResolvedValue({ id: 'frog-1', userId: 4, dateKey: '2026-09-14' });
    const second = await service.applyDueRecurrences(at);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(prisma.adminDailyFrog.create).toHaveBeenCalledTimes(1);
  });

  it('still creates one frog per user when two admins are due on the same day', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([
      dailyRec({ userId: 4 }),
      dailyRec({ id: 'r-b', userId: 9, title: 'قورباغه مدیر دوم' }),
    ]);
    prisma.adminDailyFrog.findUnique.mockResolvedValue(null);

    const result = await service.applyDueRecurrences(at);
    expect(result.created).toBe(2);
    expect(prisma.adminDailyFrog.create).toHaveBeenCalledTimes(2);
    expect(prisma.adminDailyFrog.create.mock.calls.map((call) => call[0].data.userId).sort()).toEqual([4, 9]);
  });

  it('treats unique (userId, dateKey) races as a skip, not a second frog', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([dailyRec()]);
    prisma.adminDailyFrog.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    const result = await service.applyDueRecurrences(at);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(prisma.adminFrogRecurrence.updateMany).toHaveBeenCalled();
  });

  it('scheduler delegates once to applyDueRecurrences', async () => {
    const inner = { applyDueRecurrences: jest.fn().mockResolvedValue({ today: '2026-09-14', created: 1, skipped: 0 }) };
    const scheduler = new FrogRecurrenceScheduler(inner as never);
    await scheduler.applyAtFourAmTehran();
    expect(inner.applyDueRecurrences).toHaveBeenCalledTimes(1);
  });
});
