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
    lastRunAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('frog-recurrence scheduler (multi-task)', () => {
  const prisma = {
    adminFrogRecurrence: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    adminDailyFrog: {
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

  it('creates one frog per matching recurrence for the same user on the same day', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([
      dailyRec(),
      dailyRec({ id: 'r2', title: 'الگوی دوم', createdAt: new Date('2026-01-02T00:00:00.000Z') }),
    ]);

    const first = await service.applyDueRecurrences(at);
    expect(first).toMatchObject({ today: '2026-09-14', created: 2, skipped: 0 });
    expect(prisma.adminDailyFrog.create).toHaveBeenCalledTimes(2);
    expect(prisma.adminDailyFrog.create.mock.calls.map((call) => call[0].data.title)).toEqual([
      'تمرکز صبح',
      'الگوی دوم',
    ]);
  });

  it('skips a recurrence whose lastRunAt is already today', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([
      dailyRec({ lastRunAt: new Date('2026-09-14T04:05:00.000+03:30') }),
    ]);
    const result = await service.applyDueRecurrences(at);
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(prisma.adminDailyFrog.create).not.toHaveBeenCalled();
  });

  it('still creates frogs for two admins on the same day', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([
      dailyRec({ userId: 4 }),
      dailyRec({ id: 'r-b', userId: 9, title: 'قورباغه مدیر دوم' }),
    ]);

    const result = await service.applyDueRecurrences(at);
    expect(result.created).toBe(2);
    expect(prisma.adminDailyFrog.create.mock.calls.map((call) => call[0].data.userId).sort()).toEqual([4, 9]);
  });

  it('scheduler delegates once to applyDueRecurrences', async () => {
    const inner = { applyDueRecurrences: jest.fn().mockResolvedValue({ today: '2026-09-14', created: 1, skipped: 0 }) };
    const scheduler = new FrogRecurrenceScheduler(inner as never);
    await scheduler.applyAtFourAmTehran();
    expect(inner.applyDueRecurrences).toHaveBeenCalledTimes(1);
  });
});
