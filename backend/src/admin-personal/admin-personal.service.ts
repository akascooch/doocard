import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminFrogStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateExpenseCategoryDto,
  CreateFrogRecurrenceDto,
  CreatePersonalExpenseDto,
  DEFAULT_EXPENSE_CATEGORY_NAMES,
  enumForCategoryName,
  FrogHistoryQueryDto,
  isValidDateKey,
  ListPersonalExpensesQueryDto,
  MAX_PAGE_SIZE,
  parseAmountRial,
  ToggleFrogDto,
  UpdateExpenseCategoryDto,
  UpdateFrogRecurrenceDto,
  UpsertTodayFrogDto,
  type ExpenseCategory,
  type FrogFrequency,
  type FrogStatus,
} from './dto/admin-personal.dto';

export function tehranDateKey(at = new Date()): string {
  return at.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
}

const TEHRAN_WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** JS weekday: 0 Sunday … 6 Saturday, in Asia/Tehran. */
export function tehranWeekday(at = new Date()): number {
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Tehran',
    weekday: 'short',
  }).format(at);
  return TEHRAN_WEEKDAY[label] ?? 0;
}

export function recurrenceMatchesToday(
  rec: { frequency: string; dayOfWeek: number | null; isActive: boolean },
  weekday: number,
): boolean {
  if (!rec.isActive) return false;
  if (rec.frequency === 'DAILY') return true;
  if (rec.frequency === 'WEEKLY') {
    return rec.dayOfWeek === weekday;
  }
  return false;
}

export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function monthStartKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function serializeFrog(row: {
  id: string;
  userId: number;
  dateKey: string;
  title: string;
  description: string | null;
  status: AdminFrogStatus;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    dateKey: row.dateKey,
    title: row.title,
    description: row.description,
    status: row.status,
    isCompleted: row.isCompleted,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeExpense(row: {
  id: string;
  userId: number;
  amount: bigint;
  category: string;
  categoryId?: string | null;
  title: string;
  description: string | null;
  dateKey: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  categoryRel?: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    amount: row.amount.toString(),
    category: row.category,
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryRel?.name ?? null,
    title: row.title,
    description: row.description,
    dateKey: row.dateKey,
    occurredAt: row.occurredAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeRecurrence(row: {
  id: string;
  userId: number;
  title: string;
  description: string | null;
  frequency: string;
  dayOfWeek: number | null;
  isActive: boolean;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    description: row.description,
    frequency: row.frequency,
    dayOfWeek: row.dayOfWeek,
    isActive: row.isActive,
    lastRunAt: row.lastRunAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function serializeCategory(row: {
  id: string;
  userId: number;
  name: string;
  isDefault: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    isDefault: row.isDefault,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function completionFields(
  status: AdminFrogStatus,
  existingCompletedAt?: Date | null,
) {
  if (status === AdminFrogStatus.DONE) {
    return {
      isCompleted: true,
      completedAt: existingCompletedAt ?? new Date(),
    };
  }
  return { isCompleted: false, completedAt: null as Date | null };
}

const FORWARD: Record<FrogStatus, FrogStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['DONE'],
  DONE: [],
};

@Injectable()
export class AdminPersonalService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayFrog(userId: number) {
    const today = tehranDateKey();
    const yesterday = shiftDateKey(today, -1);
    const frog = await this.prisma.adminDailyFrog.findUnique({
      where: { userId_dateKey: { userId, dateKey: today } },
    });
    const pendingRollover = frog
      ? null
      : await this.prisma.adminDailyFrog.findFirst({
          where: {
            userId,
            dateKey: yesterday,
            isCompleted: false,
            status: { not: AdminFrogStatus.DONE },
          },
        });
    return {
      today,
      frog: frog ? serializeFrog(frog) : null,
      rollover: pendingRollover ? serializeFrog(pendingRollover) : null,
    };
  }

  async upsertTodayFrog(userId: number, dto: UpsertTodayFrogDto) {
    const today = tehranDateKey();
    const yesterday = shiftDateKey(today, -1);
    let title = dto.title?.trim();
    let description = dto.description?.trim() || null;

    if (dto.rolloverId) {
      const existingToday = await this.prisma.adminDailyFrog.findUnique({
        where: { userId_dateKey: { userId, dateKey: today } },
      });
      if (existingToday) {
        throw new BadRequestException('قورباغه امروز از قبل ثبت شده است');
      }
      const source = await this.prisma.adminDailyFrog.findUnique({
        where: { id: dto.rolloverId },
      });
      if (!source || source.userId !== userId) {
        throw new NotFoundException('قورباغه قابل انتقال یافت نشد');
      }
      if (source.isCompleted || source.status === AdminFrogStatus.DONE) {
        throw new BadRequestException('قورباغه انجام‌شده منتقل نمی‌شود');
      }
      if (source.dateKey !== yesterday) {
        throw new BadRequestException('فقط قورباغه دیروز قابل انتقال است');
      }
      title = title || source.title;
      description = description ?? source.description;
    }

    if (!title || title.length < 2) {
      throw new BadRequestException('عنوان قورباغه امروز الزامی است');
    }

    const row = await this.prisma.adminDailyFrog.upsert({
      where: { userId_dateKey: { userId, dateKey: today } },
      create: {
        userId,
        dateKey: today,
        title,
        description,
        status: AdminFrogStatus.PENDING,
        ...completionFields(AdminFrogStatus.PENDING),
      },
      update: {
        title,
        description,
      },
    });
    return serializeFrog(row);
  }

  async toggleFrog(userId: number, id: string, dto: ToggleFrogDto) {
    const row = await this.prisma.adminDailyFrog.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('قورباغه یافت نشد');
    }

    const current = row.status as FrogStatus;
    const nextStatus = (dto.status ?? this.nextStatus(current)) as AdminFrogStatus;
    if (nextStatus === row.status) {
      return serializeFrog(row);
    }
    if (!FORWARD[current].includes(nextStatus as FrogStatus)) {
      throw new BadRequestException('انتقال وضعیت قورباغه نامعتبر است');
    }

    const updated = await this.prisma.adminDailyFrog.update({
      where: { id },
      data: {
        status: nextStatus,
        ...completionFields(nextStatus, row.completedAt),
      },
    });
    return serializeFrog(updated);
  }

  async listFrogHistory(userId: number, query: FrogHistoryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, MAX_PAGE_SIZE);
    const today = tehranDateKey();
    const where = { userId, dateKey: { lt: today } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.adminDailyFrog.count({ where }),
      this.prisma.adminDailyFrog.findMany({
        where,
        orderBy: { dateKey: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      page,
      pageSize,
      total,
      items: rows.map(serializeFrog),
    };
  }

  async createExpense(userId: number, dto: CreatePersonalExpenseDto) {
    let amount: bigint;
    try {
      amount = parseAmountRial(dto.amount);
    } catch {
      throw new BadRequestException('مبلغ باید عدد صحیح مثبت ریال باشد');
    }

    const dateKey = dto.dateKey || tehranDateKey();
    if (!isValidDateKey(dateKey)) {
      throw new BadRequestException('تاریخ نامعتبر است');
    }

    let category: ExpenseCategory | undefined = dto.category;
    let categoryId: string | null = null;
    if (dto.categoryId) {
      const owned = await this.prisma.adminExpenseCategory.findFirst({
        where: { id: dto.categoryId, userId, archivedAt: null },
      });
      if (!owned) {
        throw new NotFoundException('دسته یافت نشد');
      }
      categoryId = owned.id;
      category = enumForCategoryName(owned.name);
    }
    if (!category) {
      throw new BadRequestException('دسته‌بندی الزامی است');
    }

    const row = await this.prisma.adminPersonalExpense.create({
      data: {
        userId,
        amount,
        category,
        categoryId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        dateKey,
        occurredAt: new Date(`${dateKey}T12:00:00.000+03:30`),
      },
      include: { categoryRel: { select: { id: true, name: true } } },
    });
    return serializeExpense(row);
  }

  async listExpenses(userId: number, query: ListPersonalExpensesQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 20, MAX_PAGE_SIZE);
    if (query.from && !isValidDateKey(query.from)) {
      throw new BadRequestException('از تاریخ نامعتبر است');
    }
    if (query.to && !isValidDateKey(query.to)) {
      throw new BadRequestException('تا تاریخ نامعتبر است');
    }
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('بازه تاریخ نامعتبر است');
    }

    const where: Prisma.AdminPersonalExpenseWhereInput = {
      userId,
      deletedAt: null,
    };
    if (query.category) where.category = query.category;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.from || query.to) {
      where.dateKey = {};
      if (query.from) where.dateKey.gte = query.from;
      if (query.to) where.dateKey.lte = query.to;
    }
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.adminPersonalExpense.count({ where }),
      this.prisma.adminPersonalExpense.findMany({
        where,
        orderBy: [{ dateKey: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { categoryRel: { select: { id: true, name: true } } },
      }),
    ]);
    return {
      page,
      pageSize,
      total,
      items: rows.map(serializeExpense),
    };
  }

  async deleteExpense(userId: number, id: string) {
    const row = await this.prisma.adminPersonalExpense.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('هزینه یافت نشد');
    }
    await this.prisma.adminPersonalExpense.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { ok: true, id };
  }

  async listCategories(userId: number) {
    await this.ensureDefaultCategories(userId);
    const rows = await this.prisma.adminExpenseCategory.findMany({
      where: { userId, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    return { items: rows.map(serializeCategory) };
  }

  async createCategory(userId: number, dto: CreateExpenseCategoryDto) {
    await this.ensureDefaultCategories(userId);
    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('نام دسته الزامی است');
    }
    const existing = await this.prisma.adminExpenseCategory.findUnique({
      where: { userId_name: { userId, name } },
    });
    if (existing) {
      if (existing.archivedAt) {
        const restored = await this.prisma.adminExpenseCategory.update({
          where: { id: existing.id },
          data: { archivedAt: null },
        });
        return serializeCategory(restored);
      }
      throw new BadRequestException('این نام دسته از قبل وجود دارد');
    }
    const row = await this.prisma.adminExpenseCategory.create({
      data: { userId, name, isDefault: false },
    });
    return serializeCategory(row);
  }

  async updateCategory(userId: number, id: string, dto: UpdateExpenseCategoryDto) {
    const row = await this.prisma.adminExpenseCategory.findFirst({
      where: { id, userId, archivedAt: null },
    });
    if (!row) {
      throw new NotFoundException('دسته یافت نشد');
    }
    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('نام دسته الزامی است');
    }
    const clash = await this.prisma.adminExpenseCategory.findFirst({
      where: { userId, name, NOT: { id } },
    });
    if (clash) {
      throw new BadRequestException('این نام دسته از قبل وجود دارد');
    }
    const updated = await this.prisma.adminExpenseCategory.update({
      where: { id },
      data: { name },
    });
    return serializeCategory(updated);
  }

  async archiveCategory(userId: number, id: string) {
    const row = await this.prisma.adminExpenseCategory.findFirst({
      where: { id, userId, archivedAt: null },
    });
    if (!row) {
      throw new NotFoundException('دسته یافت نشد');
    }
    await this.prisma.adminExpenseCategory.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return { ok: true, id };
  }

  async ensureDefaultCategories(userId: number) {
    const count = await this.prisma.adminExpenseCategory.count({ where: { userId } });
    if (count > 0) return;
    await this.prisma.adminExpenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORY_NAMES.map((name) => ({
        userId,
        name,
        isDefault: true,
      })),
    });
  }

  async expenseSummary(userId: number) {
    const today = tehranDateKey();
    const weekStart = shiftDateKey(today, -6);
    const monthStart = monthStartKey(today);
    const owned = { userId, deletedAt: null as Date | null };

    const [todaySum, weekSum, monthSum] = await Promise.all([
      this.prisma.adminPersonalExpense.aggregate({
        where: { ...owned, dateKey: today },
        _sum: { amount: true },
      }),
      this.prisma.adminPersonalExpense.aggregate({
        where: { ...owned, dateKey: { gte: weekStart, lte: today } },
        _sum: { amount: true },
      }),
      this.prisma.adminPersonalExpense.aggregate({
        where: { ...owned, dateKey: { gte: monthStart, lte: today } },
        _sum: { amount: true },
      }),
    ]);

    return {
      today: (todaySum._sum.amount ?? 0n).toString(),
      week: (weekSum._sum.amount ?? 0n).toString(),
      month: (monthSum._sum.amount ?? 0n).toString(),
      todayKey: today,
    };
  }

  async listRecurrences(userId: number) {
    const rows = await this.prisma.adminFrogRecurrence.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return { items: rows.map(serializeRecurrence) };
  }

  async createRecurrence(userId: number, dto: CreateFrogRecurrenceDto) {
    const frequency = dto.frequency as FrogFrequency;
    const dayOfWeek = this.normalizeDayOfWeek(frequency, dto.dayOfWeek);
    const row = await this.prisma.adminFrogRecurrence.create({
      data: {
        userId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        frequency,
        dayOfWeek,
        isActive: true,
      },
    });
    return serializeRecurrence(row);
  }

  async updateRecurrence(userId: number, id: string, dto: UpdateFrogRecurrenceDto) {
    const row = await this.prisma.adminFrogRecurrence.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('الگوی تکرار یافت نشد');
    }
    const frequency = (dto.frequency ?? row.frequency) as FrogFrequency;
    if (frequency !== 'DAILY' && frequency !== 'WEEKLY') {
      throw new BadRequestException('نوع تکرار نامعتبر است');
    }
    const dayOfWeek =
      dto.frequency === 'DAILY'
        ? null
        : this.normalizeDayOfWeek(
            frequency,
            dto.dayOfWeek === undefined ? row.dayOfWeek : dto.dayOfWeek,
          );
    const updated = await this.prisma.adminFrogRecurrence.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.frequency !== undefined ? { frequency } : {}),
        ...(dto.dayOfWeek !== undefined || dto.frequency !== undefined ? { dayOfWeek } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return serializeRecurrence(updated);
  }

  async deleteRecurrence(userId: number, id: string) {
    const row = await this.prisma.adminFrogRecurrence.findFirst({
      where: { id, userId },
    });
    if (!row) {
      throw new NotFoundException('الگوی تکرار یافت نشد');
    }
    await this.prisma.adminFrogRecurrence.delete({ where: { id } });
    return { ok: true, id };
  }

  /**
   * Creates at most one AdminDailyFrog per admin per Tehran day.
   * Unique (userId, dateKey) is the hard lock; this method skips when a row exists.
   */
  async applyDueRecurrences(at = new Date()) {
    const today = tehranDateKey(at);
    const weekday = tehranWeekday(at);
    const recurrences = await this.prisma.adminFrogRecurrence.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const byUser = new Map<number, typeof recurrences>();
    for (const rec of recurrences) {
      if (!recurrenceMatchesToday(rec, weekday)) continue;
      const list = byUser.get(rec.userId) ?? [];
      list.push(rec);
      byUser.set(rec.userId, list);
    }

    let created = 0;
    let skipped = 0;
    const now = new Date();
    for (const [userId, due] of byUser) {
      const existing = await this.prisma.adminDailyFrog.findUnique({
        where: { userId_dateKey: { userId, dateKey: today } },
      });
      const ids = due.map((item) => item.id);
      if (existing) {
        skipped += 1;
        await this.prisma.adminFrogRecurrence.updateMany({
          where: { id: { in: ids } },
          data: { lastRunAt: now },
        });
        continue;
      }
      const source = due[0];
      try {
        await this.prisma.$transaction([
          this.prisma.adminDailyFrog.create({
            data: {
              userId,
              dateKey: today,
              title: source.title,
              description: source.description,
              status: AdminFrogStatus.PENDING,
              ...completionFields(AdminFrogStatus.PENDING),
            },
          }),
          this.prisma.adminFrogRecurrence.updateMany({
            where: { id: { in: ids } },
            data: { lastRunAt: now },
          }),
        ]);
        created += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          skipped += 1;
          await this.prisma.adminFrogRecurrence.updateMany({
            where: { id: { in: ids } },
            data: { lastRunAt: now },
          });
          continue;
        }
        throw error;
      }
    }
    return { today, weekday, considered: recurrences.length, created, skipped };
  }

  private normalizeDayOfWeek(frequency: FrogFrequency, dayOfWeek?: number | null): number | null {
    if (frequency === 'DAILY') return null;
    if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
      throw new BadRequestException('روز هفته برای تکرار هفتگی الزامی است');
    }
    return dayOfWeek;
  }

  private nextStatus(current: FrogStatus): FrogStatus {
    const options = FORWARD[current];
    return options[0] ?? current;
  }
}
