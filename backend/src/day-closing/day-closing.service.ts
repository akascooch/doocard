import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DayClosingService {
  constructor(private prisma: PrismaService) {}

  async getDayClosing(date: Date) {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    let dayClosing = await this.prisma.dayClosing.findUnique({
      where: { date: startOfDay },
      include: { closedByUser: true }
    });

    if (!dayClosing) {
      // Create a new day closing record if it doesn't exist
      dayClosing = await this.prisma.dayClosing.create({
        data: {
          date: startOfDay,
          totalIncome: 0,
          totalExpense: 0,
          totalTips: 0,
          totalSalaries: 0,
          isClosed: false
        },
        include: { closedByUser: true }
      });
    }

    // Calculate actual totals for the day
    const totals = await this.calculateDayTotals(startOfDay, endOfDay);

    return {
      ...dayClosing,
      ...totals
    };
  }

  async closeDay(date: Date, closedBy: number) {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const existingClosing = await this.prisma.dayClosing.findUnique({
      where: { date: startOfDay }
    });

    if (existingClosing?.isClosed) {
      throw new BadRequestException('این روز قبلاً بسته شده است');
    }

    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const totals = await this.calculateDayTotals(startOfDay, endOfDay);

    const dayClosing = await this.prisma.dayClosing.upsert({
      where: { date: startOfDay },
      update: {
        totalIncome: totals.totalIncome,
        totalExpense: totals.totalExpense,
        totalTips: totals.totalTips,
        totalSalaries: totals.totalSalaries,
        isClosed: true,
        closedAt: new Date(),
        closedBy: closedBy
      },
      create: {
        date: startOfDay,
        totalIncome: totals.totalIncome,
        totalExpense: totals.totalExpense,
        totalTips: totals.totalTips,
        totalSalaries: totals.totalSalaries,
        isClosed: true,
        closedAt: new Date(),
        closedBy: closedBy
      },
      include: { closedByUser: true }
    });

    return dayClosing;
  }

  async reopenDay(date: Date, reopenedBy: number) {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const dayClosing = await this.prisma.dayClosing.findUnique({
      where: { date: startOfDay }
    });

    if (!dayClosing) {
      throw new NotFoundException('رکورد بستن روز یافت نشد');
    }

    if (!dayClosing.isClosed) {
      throw new BadRequestException('این روز قبلاً باز است');
    }

    const updatedClosing = await this.prisma.dayClosing.update({
      where: { date: startOfDay },
      data: {
        isClosed: false,
        closedAt: null,
        closedBy: null
      },
      include: { closedByUser: true }
    });

    return updatedClosing;
  }

  async getDayClosingHistory(limit: number = 30) {
    return this.prisma.dayClosing.findMany({
      orderBy: { date: 'desc' },
      take: limit,
      include: { closedByUser: true }
    });
  }

  private async calculateDayTotals(startOfDay: Date, endOfDay: Date) {
    // Get all transactions for the day
    const transactions = await this.prisma.transaction.findMany({
      where: {
        deletedAt: null,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      }
    });

    // Get all appointments for the day
    const appointments = await this.prisma.appointment.findMany({
      where: {
        scheduledAt: {
          gte: startOfDay,
          lt: endOfDay
        }
      },
      include: {
        service: true,
        transactions: true
      }
    });

    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'INCOME' || t.type === 'SERVICE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter(t => t.type === 'EXPENSE')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalTips = transactions
      .filter(
        (t) =>
          t.type === 'TIP' ||
          (t.type === 'INCOME' && t.sourceType === 'TIP'),
      )
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalSalaries = transactions
      .filter(t => t.type === 'SALARY')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    return {
      totalIncome,
      totalExpense,
      totalTips,
      totalSalaries,
      totalAppointments: appointments.length,
      completedAppointments: appointments.filter(a => a.status === 'COMPLETED').length,
      pendingAppointments: appointments.filter(a => a.status === 'PENDING').length
    };
  }
}
