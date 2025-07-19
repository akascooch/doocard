import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateFinancialEntryDto,
  CreateSalaryDto,
  CreateFinancialCategoryDto,
  CreateBankAccountDto,
  UpdateBankAccountDto,
} from './dto';
import { UpdateFinancialEntryDto } from './dto/update-financial-entry.dto';
import { Prisma } from '@prisma/client';
import { TipTransactionType, TipTransactionStatus } from './tip-transaction.entity';
import { CreateTipTransactionDto, UpdateTipTransactionStatusDto } from './dto';
import * as jalaali from 'jalaali-js';

@Injectable()
export class AccountingService {
  constructor(
    private prisma: PrismaService,
  ) {}

  async getStats() {
    const [totalIncome, totalExpense] = await Promise.all([
      this.prisma.financialEntry.aggregate({
        where: { type: 'INCOME' },
        _sum: { amount: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: { type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthlyIncome, monthlyExpense] = await Promise.all([
      this.prisma.financialEntry.aggregate({
        where: {
          type: 'INCOME',
          date: { gte: firstDayOfMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.financialEntry.aggregate({
        where: {
          type: 'EXPENSE',
          date: { gte: firstDayOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalIncome: totalIncome._sum.amount || 0,
      totalExpense: totalExpense._sum.amount || 0,
      balance: (totalIncome._sum.amount || 0) - (totalExpense._sum.amount || 0),
      monthlyIncome: monthlyIncome._sum.amount || 0,
      monthlyExpense: monthlyExpense._sum.amount || 0,
    };
  }

  async getChartData(months: number) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    const entries = await this.prisma.financialEntry.findMany({
      where: {
        date: { gte: startDate },
      },
      select: {
        type: true,
        amount: true,
        date: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    const monthlyData = new Map<string, { income: number; expense: number }>();
    const persianMonths = [
      'فروردین',
      'اردیبهشت',
      'خرداد',
      'تیر',
      'مرداد',
      'شهریور',
      'مهر',
      'آبان',
      'آذر',
      'دی',
      'بهمن',
      'اسفند',
    ];

    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${persianMonths[date.getMonth()]}`;
      monthlyData.set(monthKey, { income: 0, expense: 0 });
    }

    entries.forEach((entry) => {
      const date = new Date(entry.date);
      const { jm } = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
      const monthKey = persianMonths[jm - 1];
      const data = monthlyData.get(monthKey);
      if (data) {
        if (entry.type === 'INCOME') {
          data.income += entry.amount;
        } else {
          data.expense += entry.amount;
        }
      }
    });

    return Array.from(monthlyData.entries()).map(([name, data]) => ({
      name,
      ...data,
    }));
  }

  async getRecentTransactions(limit: number) {
    try {
      const results = await this.prisma.financialEntry.findMany({
        take: limit,
        orderBy: {
          date: 'desc',
        },
        include: { category: true, bankAccount: true },
      });
      // تاریخ شمسی را اضافه کن
      return results.map(entry => {
        const d = new Date(entry.date);
        const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
        const dateJalali = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
        return { ...entry, dateJalali };
      });
    } catch (error) {
      console.error('Error in getRecentTransactions:', error);
      throw new Error('خطا در دریافت تراکنش‌های اخیر');
    }
  }

  async getCategories() {
    return this.prisma.financialCategory.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createCategory(createCategoryDto: CreateFinancialCategoryDto) {
    return this.prisma.financialCategory.create({
      data: {
        ...createCategoryDto,
        updatedAt: new Date(),
      },
    });
  }

  async deleteCategory(id: number) {
    const category = await this.prisma.financialCategory.findUnique({
      where: { id },
      include: {
        entries: true,
      },
    });

    if (!category) {
      throw new NotFoundException('دسته‌بندی مورد نظر یافت نشد');
    }

    if (category.entries.length > 0) {
      throw new Error('این دسته‌بندی دارای تراکنش است و نمی‌توان آن را حذف کرد');
    }

    return this.prisma.financialCategory.delete({
      where: { id },
    });
  }

  async getEntries(
    page: number,
    limit: number,
    type?: 'INCOME' | 'EXPENSE',
    categoryId?: number,
    user?: { id: number, role: string }
  ) {
    const where: any = {
      ...(type && { type }),
      ...(categoryId && { categoryId }),
    };
    // اگر نقش آرایشگر یا مشتری است فقط داده‌های خودش را ببیند
    if (user?.role === 'BARBER') {
      where.barberId = user.id;
    }
    if (user?.role === 'CUSTOMER') {
      where.customerId = user.id;
    }
    const [total, items] = await Promise.all([
      this.prisma.financialEntry.count({ where }),
      this.prisma.financialEntry.findMany({
        where,
        skip: (page - 1) * limit,
        take: Number(limit),
        orderBy: {
          date: 'desc',
        },
        include: { category: true, bankAccount: true },
      }),
    ]);
    // تاریخ شمسی را اضافه کن
    const itemsWithJalali = items.map(entry => {
      const d = new Date(entry.date);
      const j = jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
      const dateJalali = `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}`;
      return { ...entry, dateJalali };
    });

    return {
      items: itemsWithJalali,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createEntry(createEntryDto: CreateFinancialEntryDto) {
    return this.prisma.financialEntry.create({
      data: {
        amount: createEntryDto.amount,
        type: createEntryDto.type,
        date: new Date(createEntryDto.date),
        description: createEntryDto.description,
        reference: createEntryDto.reference,
        paymentMethod: createEntryDto.paymentMethod,
        createdBy: createEntryDto.createdBy,
        attachmentUrl: createEntryDto.attachmentUrl,
        updatedAt: new Date(),
        category: { connect: { id: createEntryDto.categoryId } },
        ...(createEntryDto.bankAccountId !== undefined && { bankAccount: { connect: { id: createEntryDto.bankAccountId } } }),
      },
      include: { category: true, bankAccount: true },
    });
  }

  async updateEntry(id: number, updateEntryDto: UpdateFinancialEntryDto) {
    const { categoryId, bankAccountId, ...rest } = updateEntryDto;
    return this.prisma.financialEntry.update({
      where: { id },
      data: {
        ...rest,
        ...(updateEntryDto.date && { date: new Date(updateEntryDto.date) }),
        ...(categoryId && { category: { connect: { id: categoryId } } }),
        ...(bankAccountId !== undefined && { bankAccount: { connect: { id: bankAccountId } } }),
      },
      include: { category: true, bankAccount: true },
    });
  }

  async deleteEntry(id: number) {
    return this.prisma.financialEntry.delete({
      where: { id },
    });
  }

  async getSalaries(page: number, limit: number, isPaid?: boolean) {
    const where = {
      ...(typeof isPaid === 'boolean' && { isPaid }),
    };

    const [total, items] = await Promise.all([
      this.prisma.salary.count({ where }),
      this.prisma.salary.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          month: 'desc',
        },
        include: {
          barber: true,
        },
      }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createSalary(createSalaryDto: CreateSalaryDto) {
    return this.prisma.salary.create({
      data: {
        ...createSalaryDto,
        month: new Date(createSalaryDto.month),
        updatedAt: new Date(),
      },
      include: {
        barber: true,
      },
    });
  }

  async paySalary(id: number) {
    const salary = await this.prisma.salary.findUnique({
      where: { id },
    });

    if (!salary) {
      throw new NotFoundException('حقوق مورد نظر یافت نشد');
    }

    if (salary.isPaid) {
      throw new Error('این حقوق قبلاً پرداخت شده است');
    }

    const salaryCategory = await this.prisma.financialCategory.findFirst({
      where: {
        name: 'حقوق و دستمزد',
        type: 'EXPENSE',
      },
    });

    if (!salaryCategory) {
      throw new Error('دسته‌بندی حقوق و دستمزد یافت نشد');
    }

    // Create financial entry for salary payment
    await this.prisma.financialEntry.create({
      data: {
        amount: -salary.amount,
        type: 'EXPENSE',
        date: new Date(),
        description: `پرداخت حقوق ${salary.month.toLocaleDateString('fa-IR', {
          month: 'long',
          year: 'numeric',
        })}`,
        category: {
          connect: {
            id: salaryCategory.id,
          },
        },
        status: 'COMPLETED',
        updatedAt: new Date(),
        createdBy: 1, // آیدی کاربر ادمین
      },
    });

    return this.prisma.salary.update({
      where: { id },
      data: {
        isPaid: true,
        paidAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        barber: true,
      },
    });
  }

  async deleteSalary(id: number) {
    return this.prisma.salary.delete({ where: { id } });
  }

  async updateSalary(id: number, data: { amount: number, month: string }) {
    return this.prisma.salary.update({
      where: { id },
      data: {
        amount: data.amount,
        month: data.month,
      },
    });
  }

  // ثبت تراکنش تیپ (واریز یا برداشت)
  async createTipTransaction(dto: CreateTipTransactionDto) {
    return this.prisma.tipTransaction.create({
      data: {
        ...dto,
        type: dto.type === 'deposit' ? TipTransactionType.DEPOSIT : TipTransactionType.WITHDRAW,
        status: dto.type === 'deposit' ? TipTransactionStatus.APPROVED : TipTransactionStatus.PENDING,
        date: new Date(),
      },
    });
  }

  // دریافت مجموع تیپ روزانه (بر اساس جدول transaction و type = 'TIP')
  async getDailyTipSum(date: string, staffIds?: number[]) {
    const start = new Date(date + 'T00:00:00');
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const where: any = {
      type: 'TIP',
      createdAt: {
        gte: start,
        lt: end,
      },
    };
    if (staffIds && staffIds.length > 0) {
      where.barberId = { in: staffIds };
    }
    // لاگ برای بررسی دیتای پیدا شده
    const tips = await this.prisma.transaction.findMany({ where });
    console.log('🔵 Daily tips (from transaction) found:', tips.map(t => ({ id: t.id, createdAt: t.createdAt, amount: t.amount, type: t.type })));
    const result = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where,
    });
    return { sum: Number(result._sum.amount) || 0 };
  }

  // دریافت لیست تراکنش‌های تیپ (فیلتر بر اساس تاریخ/کارمند)
  async getTipTransactions(date?: string, staffId?: number) {
    const where: any = {};
    if (date) {
      where.date = {
        gte: new Date(date + 'T00:00:00.000Z'),
        lte: new Date(date + 'T23:59:59.999Z'),
      };
    }
    if (staffId) where.staffId = staffId;
    return this.prisma.tipTransaction.findMany({ where, orderBy: { date: 'desc' } });
  }

  // تغییر وضعیت برداشت تیپ (تأیید/رد توسط ادمین)
  async updateTipTransactionStatus(id: number, dto: UpdateTipTransactionStatusDto) {
    const tip = await this.prisma.tipTransaction.findUnique({ where: { id } });
    if (!tip) throw new NotFoundException('تراکنش تیپ یافت نشد');
    return this.prisma.tipTransaction.update({
      where: { id },
      data: {
        status:
          dto.status === TipTransactionStatus.APPROVED
            ? TipTransactionStatus.APPROVED
            : dto.status === TipTransactionStatus.REJECTED
            ? TipTransactionStatus.REJECTED
            : TipTransactionStatus.PENDING,
      },
    });
  }

  // --- Bank Account CRUD ---
  async createBankAccount(dto: CreateBankAccountDto) {
    // شماره کارت را بدون فاصله و با خط تیره ذخیره کن
    const cardNumber = dto.cardNumber.replace(/\s+/g, '');
    return this.prisma.bankAccount.create({
      data: {
        name: dto.name,
        cardNumber,
        updatedAt: new Date(),
      },
    });
  }

  async getBankAccounts() {
    return this.prisma.bankAccount.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getBankAccountById(id: number) {
    const account = await this.prisma.bankAccount.findUnique({ where: { id } });
    if (!account) throw new NotFoundException('حساب بانکی یافت نشد');
    return account;
  }

  async updateBankAccount(id: number, dto: UpdateBankAccountDto) {
    return this.prisma.bankAccount.update({
      where: { id },
      data: {
        ...dto,
        updatedAt: new Date(),
      },
    });
  }

  async deleteBankAccount(id: number) {
    return this.prisma.bankAccount.delete({ where: { id } });
  }

  // --- Bank Transfer ---
  async transferBetweenAccounts({ fromAccountId, toAccountId, amount, description, createdBy }: { fromAccountId: number, toAccountId: number, amount: number, description?: string, createdBy: number }) {
    if (fromAccountId === toAccountId) throw new Error('حساب مبدا و مقصد نباید یکسان باشد');
    if (amount <= 0) throw new Error('مبلغ باید مثبت باشد');
    const [from, to] = await Promise.all([
      this.prisma.bankAccount.findUnique({ where: { id: fromAccountId } }),
      this.prisma.bankAccount.findUnique({ where: { id: toAccountId } }),
    ]);
    if (!from || !to) throw new Error('حساب مبدا یا مقصد یافت نشد');
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // برداشت از مبدا
      const expense = await tx.transaction.create({
        data: {
          amount: -Math.abs(amount),
          paymentMethod: 'TRANSFER',
          createdAt: now,
          updatedAt: now,
          appointmentId: 1, // فرضی، اگر نیاز به ارتباط با نوبت خاصی نیست
          status: 'COMPLETED',
          category: 'OTHER',
          type: 'TRANSFER',
          bankAccountId: fromAccountId,
          description: description ? `انتقال به ${to.name}: ${description}` : `انتقال به ${to.name}`,
        },
      });
      // واریز به مقصد
      const income = await tx.transaction.create({
        data: {
          amount: Math.abs(amount),
          paymentMethod: 'TRANSFER',
          createdAt: now,
          updatedAt: now,
          appointmentId: 1, // فرضی
          status: 'COMPLETED',
          category: 'OTHER',
          type: 'TRANSFER',
          bankAccountId: toAccountId,
          description: description ? `انتقال از ${from.name}: ${description}` : `انتقال از ${from.name}`,
        },
      });
      return { expense, income };
    });
  }

  async getSetting(key: string) {
    return this.prisma.setting.findUnique({ where: { key } });
  }

  async setSetting(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  // 1. لیست آرایشگران با موجودی و مجموع برداشت‌ها
  async getBarbersBalances() {
    const barbers = await this.prisma.barber.findMany({
      select: { id: true, firstName: true, lastName: true }
    });
    // دریافت همه نوبت‌های تسویه‌شده
    const appointments = await this.prisma.appointment.findMany({
      where: { status: 'COMPLETED' },
      select: { id: true, barberId: true }
    });
    const appointmentBarberMap = new Map<number, number>();
    appointments.forEach(a => appointmentBarberMap.set(a.id, a.barberId));
    // دریافت همه تراکنش‌های مالی مرتبط با نوبت‌ها
    const entries = await this.prisma.financialEntry.findMany({ where: { type: 'INCOME' } });
    // دریافت برداشت‌های تاییدشده
    const withdrawals = await this.prisma.barberWithdrawalRequest.findMany({ where: { status: 'APPROVED' } });
    return barbers.map(b => {
      // مجموع درآمد از نوبت‌های تسویه‌شده این آرایشگر
      const totalIncome = entries.filter(e => {
        if (e.reference && e.reference.startsWith('APPT-')) {
          const apptId = Number(e.reference.replace('APPT-', ''));
          return appointmentBarberMap.get(apptId) === b.id;
        }
        return false;
      }).reduce((sum, e) => sum + e.amount, 0);
      const totalWithdrawn = withdrawals.filter(w => w.barberId === b.id).reduce((sum, w) => sum + w.amount, 0);
      return {
        id: b.id,
        name: b.firstName + ' ' + b.lastName,
        totalIncome,
        totalWithdrawn,
        balance: totalIncome - totalWithdrawn
      };
    });
  }

  // 2. ثبت درخواست برداشت
  async requestBarberWithdrawal(barberId: number, amount: number) {
    return this.prisma.barberWithdrawalRequest.create({
      data: { barberId, amount, status: 'PENDING', updatedAt: new Date() },
    });
  }

  // 3. لیست درخواست‌های برداشت (ادمین)
  async getBarberWithdrawals(status?: string) {
    const withdrawals = await this.prisma.barberWithdrawalRequest.findMany({
      where: status ? { status: status.toUpperCase() as any } : {},
      include: { barber: true },
      orderBy: { createdAt: 'desc' },
    });
    // برای هر withdrawal، تراکنش مالی مرتبط را پیدا کن
    const entries = await this.prisma.financialEntry.findMany({
      where: { reference: { in: withdrawals.map(w => `WITHDRAWAL-${w.id}`) } },
      include: { bankAccount: true },
    });
    return withdrawals.map(w => {
      const entry = entries.find(e => e.reference === `WITHDRAWAL-${w.id}`);
      return {
        ...w,
        paid: !!entry,
        paidAt: entry ? entry.date : null,
        bankAccount: entry ? entry.bankAccount : null,
      };
    });
  }

  // 4. تایید درخواست برداشت
  async approveBarberWithdrawal(id: number, adminId: number, bankAccountId: number) {
    const withdrawal = await this.prisma.barberWithdrawalRequest.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: adminId, updatedAt: new Date() },
      include: { barber: true },
    });
    // ثبت تراکنش مالی پرداخت حقوق
    const salaryCategory = await this.prisma.financialCategory.findFirst({
      where: { name: 'حقوق و دستمزد', type: 'EXPENSE' }
    });
    if (salaryCategory) {
      await this.createEntry({
        amount: -withdrawal.amount,
        type: 'EXPENSE',
        date: new Date().toISOString(),
        description: `پرداخت حقوق به آرایشگر ${withdrawal.barber.firstName} ${withdrawal.barber.lastName} بابت برداشت`,
        categoryId: salaryCategory.id,
        reference: `WITHDRAWAL-${withdrawal.id}`,
        paymentMethod: 'CASH',
        createdBy: adminId,
        bankAccountId,
      });
    }
    return withdrawal;
  }

  // 5. رد درخواست برداشت
  async rejectBarberWithdrawal(id: number, adminId: number) {
    return this.prisma.barberWithdrawalRequest.update({
      where: { id },
      data: { status: 'REJECTED', approvedBy: adminId, updatedAt: new Date() },
    });
  }

  // حذف درخواست برداشت و تراکنش مالی مرتبط
  async deleteBarberWithdrawal(id: number) {
    // حذف financialEntry مرتبط
    await this.prisma.financialEntry.deleteMany({ where: { reference: `WITHDRAWAL-${id}` } });
    // حذف خود withdrawal
    const deleted = await this.prisma.barberWithdrawalRequest.delete({ where: { id } });
    // مبلغ به موجودی آرایشگر برمی‌گردد چون در محاسبه موجودی، برداشت حذف شده لحاظ نمی‌شود
    return deleted;
  }
  // ویرایش درخواست برداشت و تراکنش مالی مرتبط
  async updateBarberWithdrawal(id: number, data: { amount: number, bankAccountId?: number, description?: string }) {
    const withdrawal = await this.prisma.barberWithdrawalRequest.update({
      where: { id },
      data: { amount: data.amount, updatedAt: new Date() },
    });
    // ویرایش financialEntry مرتبط (در صورت وجود)
    await this.prisma.financialEntry.updateMany({
      where: { reference: `WITHDRAWAL-${id}` },
      data: {
        amount: -data.amount,
        ...(data.bankAccountId && { bankAccountId: data.bankAccountId }),
        ...(data.description && { description: data.description }),
        updatedAt: new Date(),
      },
    });
    return withdrawal;
  }
} 