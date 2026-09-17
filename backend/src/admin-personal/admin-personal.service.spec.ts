import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminFrogStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdminPersonalService, recurrenceMatchesToday, shiftDateKey, tehranDateKey, tehranWeekday } from './admin-personal.service';
import { tehranJalaliDateKey, tehranScheduledAt } from './frog-schedule.util';
import {
  CreatePersonalExpenseDto,
  FrogHistoryQueryDto,
  ListPersonalExpensesQueryDto,
  MAX_AMOUNT_RIAL,
  UpsertTodayFrogDto,
  isValidDateKey,
  parseAmountRial,
} from './dto/admin-personal.dto';

describe('tehran date helpers', () => {
  it('shifts YYYY-MM-DD without timezone drift', () => {
    expect(shiftDateKey('2026-09-13', -1)).toBe('2026-09-12');
    expect(shiftDateKey('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('uses Asia/Tehran civil day around midnight (+03:30)', () => {
    expect(tehranDateKey(new Date('2026-09-12T20:29:59.999Z'))).toBe('2026-09-12');
    expect(tehranDateKey(new Date('2026-09-12T20:30:00.000Z'))).toBe('2026-09-13');
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidDateKey('2026-09-13')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-13-01')).toBe(false);
  });

  it('maps Tehran weekday 0=Sun..6=Sat', () => {
    expect(tehranWeekday(new Date('2026-09-13T12:00:00.000+03:30'))).toBe(0);
    expect(tehranWeekday(new Date('2026-09-14T12:00:00.000+03:30'))).toBe(1);
  });

  it('matches DAILY always and WEEKLY only on dayOfWeek', () => {
    expect(recurrenceMatchesToday({ frequency: 'DAILY', dayOfWeek: null, isActive: true }, 3)).toBe(true);
    expect(recurrenceMatchesToday({ frequency: 'WEEKLY', dayOfWeek: 1, isActive: true }, 1)).toBe(true);
    expect(recurrenceMatchesToday({ frequency: 'WEEKLY', dayOfWeek: 1, isActive: true }, 2)).toBe(false);
    expect(recurrenceMatchesToday({ frequency: 'DAILY', dayOfWeek: null, isActive: false }, 1)).toBe(false);
  });
});

describe('parseAmountRial', () => {
  it('accepts integer strings and numbers within the documented max', () => {
    expect(parseAmountRial('1250000')).toBe(1250000n);
    expect(parseAmountRial(1250000)).toBe(1250000n);
    expect(parseAmountRial(String(MAX_AMOUNT_RIAL))).toBe(BigInt(MAX_AMOUNT_RIAL));
  });

  it('rejects decimal, negative, empty, and oversized values', () => {
    expect(() => parseAmountRial('12.5')).toThrow();
    expect(() => parseAmountRial(-1)).toThrow();
    expect(() => parseAmountRial(0)).toThrow();
    expect(() => parseAmountRial('')).toThrow();
    expect(() => parseAmountRial(Number.NaN)).toThrow();
    expect(() => parseAmountRial(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => parseAmountRial(String(MAX_AMOUNT_RIAL) + '0')).toThrow();
  });
});

describe('CreatePersonalExpenseDto', () => {
  it('rejects extra userId and decimal amount', async () => {
    const extra = plainToInstance(CreatePersonalExpenseDto, {
      amount: '1000',
      category: 'PETTY_CASH',
      title: 'نان',
      userId: 99,
    });
    const extraErrors = await validate(extra, { whitelist: true, forbidNonWhitelisted: true });
    expect(extraErrors.some((err) => err.property === 'userId')).toBe(true);

    const decimal = plainToInstance(CreatePersonalExpenseDto, {
      amount: '12.5',
      category: 'PETTY_CASH',
      title: 'نان',
    });
    const decimalErrors = await validate(decimal);
    expect(decimalErrors.some((err) => err.property === 'amount')).toBe(true);
  });

  it('normalizes HTML time input HH:mm:ss down to HH:mm', async () => {
    const dto = plainToInstance(UpsertTodayFrogDto, { title: 'کار', dueTime: '14:30:00' });
    const errors = await validate(dto);
    expect(errors.filter((err) => err.property === 'dueTime')).toHaveLength(0);
    expect(dto.dueTime).toBe('14:30');
  });

  it('rejects invalid page, pageSize, and dates on list/history query DTOs', async () => {
    const history = plainToInstance(FrogHistoryQueryDto, { page: 0, pageSize: 999 });
    const historyErrors = await validate(history);
    expect(historyErrors.some((err) => err.property === 'page')).toBe(true);
    expect(historyErrors.some((err) => err.property === 'pageSize')).toBe(true);

    const list = plainToInstance(ListPersonalExpensesQueryDto, {
      from: '13-09-2026',
      to: '2026-02-30',
      page: -1,
    });
    const listErrors = await validate(list);
    expect(listErrors.some((err) => err.property === 'from')).toBe(true);
    expect(listErrors.some((err) => err.property === 'page')).toBe(true);
  });
});

describe('AdminPersonalService', () => {
  const prisma = {
    adminDailyFrog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    adminPersonalExpense: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    adminExpenseCategory: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    adminFrogRecurrence: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    transaction: { create: jest.fn(), update: jest.fn() },
    order: { create: jest.fn(), update: jest.fn() },
    customer: { update: jest.fn() },
    appointment: { update: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new AdminPersonalService(prisma as never);

  const noonTehran = () => new Date(`${tehranDateKey()}T12:00:00+03:30`);

  const frogRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'f1',
    userId: 1,
    dateKey: tehranDateKey(),
    title: 'کار',
    description: null,
    status: AdminFrogStatus.PENDING,
    isCompleted: false,
    completedAt: null,
    scheduledAt: noonTehran(),
    reminderSent: false,
    reminderSentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET today is read-only and does not create rows', async () => {
    prisma.adminDailyFrog.findMany.mockResolvedValue([]);
    prisma.adminDailyFrog.findFirst.mockResolvedValue(null);
    await service.getTodayFrog(1);
    expect(prisma.adminDailyFrog.create).not.toHaveBeenCalled();
    expect(prisma.adminDailyFrog.upsert).not.toHaveBeenCalled();
  });

  it('rapid GET today across Tehran midnight never writes rows', async () => {
    prisma.adminDailyFrog.findMany.mockResolvedValue([]);
    prisma.adminDailyFrog.findFirst.mockResolvedValue(null);
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date('2026-09-12T20:29:59.000Z'));
      await Promise.all([
        service.getTodayFrog(11),
        service.getTodayFrog(11),
        service.getTodayFrog(11),
      ]);
      jest.setSystemTime(new Date('2026-09-12T20:30:01.000Z'));
      await Promise.all([service.getTodayFrog(11), service.getTodayFrog(11)]);
    } finally {
      jest.useRealTimers();
    }
    expect(prisma.adminDailyFrog.create).not.toHaveBeenCalled();
    expect(prisma.adminDailyFrog.upsert).not.toHaveBeenCalled();
    expect(prisma.adminDailyFrog.update).not.toHaveBeenCalled();
  });

  it('does not offer a completed yesterday frog as rollover', async () => {
    prisma.adminDailyFrog.findMany.mockResolvedValue([]);
    prisma.adminDailyFrog.findFirst.mockResolvedValue(null);
    const result = await service.getTodayFrog(7);
    expect(result.rollover).toBeNull();
    expect(prisma.adminDailyFrog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 7,
          isCompleted: false,
        }),
      }),
    );
  });

  it('returns yesterday incomplete frog as rollover when today is empty', async () => {
    prisma.adminDailyFrog.findMany.mockResolvedValue([]);
    prisma.adminDailyFrog.findFirst.mockResolvedValue(
      frogRow({
        id: 'old',
        dateKey: '2026-09-12',
        title: 'تماس با تامین‌کننده',
        status: AdminFrogStatus.IN_PROGRESS,
      }),
    );

    const result = await service.getTodayFrog(1);
    expect(result.frog).toBeNull();
    expect(result.items).toEqual([]);
    expect(result.rollover?.id).toBe('old');
  });

  it('rejects rollover of another owner or a completed frog', async () => {
    prisma.adminDailyFrog.findUnique.mockResolvedValueOnce({
      id: 'old',
      userId: 2,
      isCompleted: false,
      status: 'PENDING',
      dateKey: 'x',
      scheduledAt: noonTehran(),
    });
    await expect(service.upsertTodayFrog(1, { rolloverId: 'old' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.adminDailyFrog.findUnique.mockResolvedValueOnce({
      id: 'old',
      userId: 1,
      isCompleted: true,
      status: AdminFrogStatus.DONE,
      dateKey: shiftDateKey(tehranDateKey(), -1),
      title: 'done',
      scheduledAt: noonTehran(),
    });
    await expect(service.upsertTodayFrog(1, { rolloverId: 'old' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates a new today frog from yesterday rollover even if today already has tasks', async () => {
    const yesterday = shiftDateKey(tehranDateKey(), -1);
    prisma.adminDailyFrog.findUnique.mockResolvedValueOnce(
      frogRow({
        id: 'old',
        title: 'قورباغه دیروز',
        description: 'جزئیات',
        dateKey: yesterday,
      }),
    );
    prisma.adminDailyFrog.create.mockResolvedValue(
      frogRow({
        id: 'new',
        title: 'قورباغه دیروز',
        description: 'جزئیات',
      }),
    );

    const row = await service.upsertTodayFrog(1, { rolloverId: 'old' });
    expect(row.title).toBe('قورباغه دیروز');
    expect(prisma.adminDailyFrog.create).toHaveBeenCalledTimes(1);
    expect(prisma.adminDailyFrog.upsert).not.toHaveBeenCalled();
  });

  it('creates a new frog for the authenticated owner (multiple per day allowed)', async () => {
    prisma.adminDailyFrog.create.mockResolvedValue(
      frogRow({ id: 'new', userId: 8, title: 'کار امروز' }),
    );
    await service.upsertTodayFrog(8, { title: 'کار امروز', dueTime: '14:30' });
    expect(prisma.adminDailyFrog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 8,
          dateKey: tehranJalaliDateKey(),
          title: 'کار امروز',
        }),
      }),
    );
    expect(prisma.adminDailyFrog.upsert).not.toHaveBeenCalled();
  });

  it('rejects past Jalali dates', async () => {
    await expect(
      service.upsertTodayFrog(8, { title: 'دیر', dateKey: '1400-01-01', dueTime: '09:00' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes only the authenticated owner frog', async () => {
    prisma.adminDailyFrog.findUnique.mockResolvedValueOnce(frogRow({ id: 'f1', userId: 1 }));
    prisma.adminDailyFrog.delete.mockResolvedValueOnce({});
    await expect(service.deleteFrog(1, 'f1')).resolves.toEqual({ ok: true, id: 'f1' });
    expect(prisma.adminDailyFrog.delete).toHaveBeenCalledWith({ where: { id: 'f1' } });

    prisma.adminDailyFrog.findUnique.mockResolvedValueOnce(frogRow({ id: 'f2', userId: 99 }));
    await expect(service.deleteFrog(1, 'f2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.adminDailyFrog.delete).toHaveBeenCalledTimes(1);
  });

  it('lists every frog for the requested date, not a single unique row', async () => {
    prisma.adminDailyFrog.findMany.mockResolvedValue([
      frogRow({ id: 'a', title: 'اول', scheduledAt: new Date(`${tehranDateKey()}T09:00:00+03:30`) }),
      frogRow({ id: 'b', title: 'دوم', scheduledAt: new Date(`${tehranDateKey()}T14:30:00+03:30`) }),
    ]);
    const result = await service.getTodayFrog(1);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((row) => row.title)).toEqual(['اول', 'دوم']);
    expect(result.frog?.id).toBe('a');
    expect(result.items[1].dueTime).toBe('14:30');
    expect(prisma.adminDailyFrog.findFirst).not.toHaveBeenCalled();
  });

  it('rejects invalid expense dates and caps page size', async () => {
    await expect(
      service.createExpense(1, {
        amount: '1000',
        category: 'PETTY_CASH',
        title: 'نان',
        dateKey: '2026-02-30',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.adminPersonalExpense.create).not.toHaveBeenCalled();

    await expect(service.listExpenses(1, { from: '2026-02-30' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.listExpenses(1, { from: '2026-09-13', to: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.$transaction.mockResolvedValue([0, []]);
    await service.listExpenses(9, { page: 1, pageSize: 999 });
    expect(prisma.adminPersonalExpense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 9, deletedAt: null },
        take: 50,
      }),
    );
  });

  it('lists only the owner\'s non-deleted expenses', async () => {
    prisma.$transaction.mockResolvedValue([0, []]);
    await service.listExpenses(5, { from: '2026-09-01', to: '2026-09-13' });
    expect(prisma.adminPersonalExpense.count).toHaveBeenCalledWith({
      where: {
        userId: 5,
        deletedAt: null,
        dateKey: { gte: '2026-09-01', lte: '2026-09-13' },
      },
    });
  });

  it('advances PENDING → IN_PROGRESS → DONE and does not reset DONE', async () => {
    prisma.adminDailyFrog.findUnique.mockResolvedValue({
      id: 'f1',
      userId: 1,
      status: AdminFrogStatus.PENDING,
      completedAt: null,
      scheduledAt: noonTehran(),
      reminderSent: false,
      reminderSentAt: null,
    });
    prisma.adminDailyFrog.update.mockResolvedValue(
      frogRow({
        id: 'f1',
        dateKey: '2026-09-13',
        title: 'x',
        status: AdminFrogStatus.IN_PROGRESS,
      }),
    );
    const progressed = await service.toggleFrog(1, 'f1', {});
    expect(progressed.status).toBe('IN_PROGRESS');

    prisma.adminDailyFrog.findUnique.mockResolvedValue(
      frogRow({
        id: 'f1',
        status: AdminFrogStatus.DONE,
        isCompleted: true,
        completedAt: new Date('2026-09-13T10:00:00.000Z'),
        dateKey: '2026-09-13',
        title: 'x',
      }),
    );
    const done = await service.toggleFrog(1, 'f1', {});
    expect(done.status).toBe('DONE');
    expect(prisma.adminDailyFrog.update).toHaveBeenCalledTimes(1);

    await expect(
      service.toggleFrog(1, 'f1', { status: 'PENDING' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not toggle or update another admin frog', async () => {
    prisma.adminDailyFrog.findUnique.mockResolvedValue({
      id: 'f1',
      userId: 99,
      status: AdminFrogStatus.PENDING,
    });
    await expect(service.toggleFrog(1, 'f1', {})).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.adminDailyFrog.update).not.toHaveBeenCalled();
  });

  it('history is owner-scoped and excludes today', async () => {
    prisma.$transaction.mockResolvedValue([0, []]);
    await service.listFrogHistory(3, { page: 1, pageSize: 20 });
    expect(prisma.adminDailyFrog.count).toHaveBeenCalledWith({
      where: { userId: 3, scheduledAt: { lt: tehranScheduledAt(tehranJalaliDateKey(), '00:00') } },
    });
  });

  it('stores expense amount as BigInt, returns decimal string, and never writes ledger tables', async () => {
    prisma.adminPersonalExpense.create.mockResolvedValue({
      id: 'e1',
      userId: 1,
      amount: 1250000n,
      category: 'PETTY_CASH',
      title: 'نان',
      description: null,
      dateKey: '2026-09-13',
      occurredAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const row = await service.createExpense(1, {
      amount: '1250000',
      category: 'PETTY_CASH',
      title: 'نان',
      dateKey: '2026-09-13',
    });
    expect(row.amount).toBe('1250000');
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.transaction.update).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(prisma.appointment.update).not.toHaveBeenCalled();
  });

  it('summarizes today/week/month as decimal strings scoped to owner', async () => {
    prisma.adminPersonalExpense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 100n } })
      .mockResolvedValueOnce({ _sum: { amount: 300n } })
      .mockResolvedValueOnce({ _sum: { amount: 900n } });
    const sum = await service.expenseSummary(4);
    expect(sum).toMatchObject({ today: '100', week: '300', month: '900' });
    expect(prisma.adminPersonalExpense.aggregate.mock.calls[0][0].where.userId).toBe(4);
    expect(prisma.adminPersonalExpense.aggregate.mock.calls[0][0].where.deletedAt).toBeNull();
  });

  it('soft-deletes own expense only and hides other owners', async () => {
    prisma.adminPersonalExpense.findFirst.mockResolvedValue({ id: 'e1', userId: 1, deletedAt: null });
    prisma.adminPersonalExpense.update.mockResolvedValue({});
    await expect(service.deleteExpense(1, 'e1')).resolves.toEqual({ ok: true, id: 'e1' });
    expect(prisma.adminPersonalExpense.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
    );

    prisma.adminPersonalExpense.findFirst.mockResolvedValue({ id: 'e2', userId: 2, deletedAt: null });
    await expect(service.deleteExpense(1, 'e2')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.adminPersonalExpense.delete).not.toHaveBeenCalled();
  });

  it('seeds default categories once per owner and rejects another owner\'s categoryId', async () => {
    prisma.adminExpenseCategory.count.mockResolvedValue(0);
    prisma.adminExpenseCategory.createMany.mockResolvedValue({ count: 4 });
    prisma.adminExpenseCategory.findMany.mockResolvedValue([
      { id: 'c1', userId: 7, name: 'خوراک', isDefault: true, archivedAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    const listed = await service.listCategories(7);
    expect(prisma.adminExpenseCategory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ userId: 7, name: 'خوراک' })]) }),
    );
    expect(listed.items[0].name).toBe('خوراک');

    prisma.adminExpenseCategory.findFirst.mockResolvedValue(null);
    await expect(
      service.createExpense(7, { amount: '1000', title: 'چای', categoryId: 'other-owner' } as never),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.adminPersonalExpense.create).not.toHaveBeenCalled();
  });

  it('archives only the owner category', async () => {
    prisma.adminExpenseCategory.findFirst
      .mockResolvedValueOnce({
        id: 'c9',
        userId: 3,
        name: 'سفارشی',
        isDefault: false,
        archivedAt: null,
      })
      .mockResolvedValueOnce(null);
    prisma.adminExpenseCategory.update.mockResolvedValue({});
    await expect(service.archiveCategory(3, 'c9')).resolves.toEqual({ ok: true, id: 'c9' });
    await expect(service.archiveCategory(3, 'c8')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.adminExpenseCategory.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: expect.objectContaining({ id: 'c8', userId: 3, archivedAt: null }) }),
    );
    expect(prisma.adminExpenseCategory.update).toHaveBeenCalledTimes(1);
  });

  it('creates one frog per due recurrence for the same admin on the same day', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([
      {
        id: 'r1',
        userId: 4,
        title: 'تمرکز صبح',
        description: null,
        frequency: 'DAILY',
        dayOfWeek: null,
        isActive: true,
        lastRunAt: null,
        createdAt: new Date('2026-01-01'),
      },
      {
        id: 'r2',
        userId: 4,
        title: 'دومین الگو',
        description: null,
        frequency: 'DAILY',
        dayOfWeek: null,
        isActive: true,
        lastRunAt: null,
        createdAt: new Date('2026-01-02'),
      },
    ]);
    prisma.adminDailyFrog.create.mockResolvedValue({});
    prisma.adminFrogRecurrence.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) => Promise.all(ops));
    const at = new Date('2026-09-14T12:00:00.000+03:30');
    const result = await service.applyDueRecurrences(at);
    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(prisma.adminDailyFrog.create).toHaveBeenCalledTimes(2);
    expect(prisma.adminDailyFrog.create.mock.calls[0][0].data.title).toBe('تمرکز صبح');
    expect(prisma.adminDailyFrog.create.mock.calls[1][0].data.title).toBe('دومین الگو');
  });

  it('skips a recurrence that already ran today even if other frogs exist', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([
      {
        id: 'r1',
        userId: 4,
        title: 'تمرکز صبح',
        description: null,
        frequency: 'DAILY',
        dayOfWeek: null,
        isActive: true,
        lastRunAt: new Date('2026-09-14T04:00:00.000+03:30'),
        createdAt: new Date(),
      },
    ]);
    const result = await service.applyDueRecurrences(new Date('2026-09-14T12:00:00.000+03:30'));
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);
    expect(prisma.adminDailyFrog.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips weekly recurrences on a non-matching Tehran weekday', async () => {
    prisma.adminFrogRecurrence.findMany.mockResolvedValue([
      {
        id: 'r-w',
        userId: 9,
        title: 'فقط دوشنبه',
        description: null,
        frequency: 'WEEKLY',
        dayOfWeek: 1,
        isActive: true,
        createdAt: new Date(),
      },
    ]);
    const sunday = new Date('2026-09-13T12:00:00.000+03:30');
    const result = await service.applyDueRecurrences(sunday);
    expect(tehranWeekday(sunday)).toBe(0);
    expect(result.created).toBe(0);
    expect(prisma.adminDailyFrog.create).not.toHaveBeenCalled();
  });

  it('rejects another owner recurrence on delete', async () => {
    prisma.adminFrogRecurrence.findFirst.mockResolvedValue(null);
    await expect(service.deleteRecurrence(1, 'r-x')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.adminFrogRecurrence.delete).not.toHaveBeenCalled();
  });
});
