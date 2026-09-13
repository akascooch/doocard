import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminFrogStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePersonalExpenseDto,
  FrogHistoryQueryDto,
  isValidDateKey,
  ListPersonalExpensesQueryDto,
  MAX_PAGE_SIZE,
  parseAmountRial,
  ToggleFrogDto,
  UpsertTodayFrogDto,
  type FrogStatus,
} from './dto/admin-personal.dto';

export function tehranDateKey(at = new Date()): string {
  return at.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
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
  title: string;
  description: string | null;
  dateKey: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    amount: row.amount.toString(),
    category: row.category,
    title: row.title,
    description: row.description,
    dateKey: row.dateKey,
    occurredAt: row.occurredAt,
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

    const row = await this.prisma.adminPersonalExpense.create({
      data: {
        userId,
        amount,
        category: dto.category,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        dateKey,
        occurredAt: new Date(`${dateKey}T12:00:00.000+03:30`),
      },
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

  private nextStatus(current: FrogStatus): FrogStatus {
    const options = FORWARD[current];
    return options[0] ?? current;
  }
}
