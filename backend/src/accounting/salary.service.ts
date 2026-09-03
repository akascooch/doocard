import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BARBER_APPOINTMENT_DEDUCTION_RIAL } from '../common/constants/employee-commission.constants';

export interface SalaryCalculationParams {
  employeeId: number;
  startDate: Date;
  endDate: Date;
  includeTips?: boolean;
}

export interface SalaryBreakdown {
  baseSalary: number;
  serviceCommission: number;
  tipShare: number;
  totalSalary: number;
  employeeShare: number;
  salonShare: number;
  totalAppointments: number;
  deductionPerAppointmentAmount: number;
  totalDeduction: number;
  payoutNetAfterDeduction: number;
}

@Injectable()
export class SalaryService {
  constructor(private prisma: PrismaService) {}

  /**
   * محاسبه حقوق کامل کارمند برای یک بازه زمانی
   */
  async calculateSalary(params: SalaryCalculationParams): Promise<SalaryBreakdown> {
    const { employeeId, startDate, endDate, includeTips = true } = params;

    // دریافت اطلاعات کارمند
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // دریافت نوبت‌های تکمیل شده در بازه زمانی
    const appointments = await this.prisma.appointment.findMany({
      where: {
        employeeId,
        status: { in: ['COMPLETED', 'SETTLED', 'PAID'] },
        scheduledAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        id: true,
        amount: true,
      }
    });

    // محاسبه درآمد خدمات (از فیلد amount)
    const serviceRevenue = appointments.reduce((sum, apt) => {
      return sum + Number(apt.amount || 0);
    }, 0);

    // محاسبه کمیسیون خدمات
    const serviceCommission = serviceRevenue * (employee.commissionRate / 100);

    // محاسبه سهم تیپ
    let tipShare = 0;
    if (includeTips) {
      const tips = await this.prisma.tip.findMany({
        where: {
          employeeId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      tipShare = tips.reduce((sum, tip) => sum + tip.amount, 0);
    }

    const totalSalary = employee.baseSalary + serviceCommission + tipShare;
    const totalAppointments = appointments.length;
    const totalDeduction = totalAppointments * BARBER_APPOINTMENT_DEDUCTION_RIAL;
    const payoutNetAfterDeduction = totalSalary - totalDeduction;

    return {
      baseSalary: employee.baseSalary,
      serviceCommission,
      tipShare,
      totalSalary,
      employeeShare: totalSalary,
      salonShare: serviceRevenue - serviceCommission,
      totalAppointments,
      deductionPerAppointmentAmount: BARBER_APPOINTMENT_DEDUCTION_RIAL,
      totalDeduction,
      payoutNetAfterDeduction,
    };
  }

  /**
   * ایجاد درخواست حقوق
   */
  async createSalaryRequest(params: {
    employeeId: number;
    periodStart: Date;
    periodEnd: Date;
    amount: number;
  }) {
    const { employeeId, periodStart, periodEnd, amount } = params;

    // بررسی وجود کارمند
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true }
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    // ایجاد درخواست حقوق
    const salary = await this.prisma.salary.create({
      data: {
        employeeId,
        periodStart,
        periodEnd,
        amount,
        status: 'PENDING'
      },
      include: {
        employee: {
          include: { user: true }
        }
      }
    });

    return salary;
  }

  /**
   * پرداخت حقوق
   */
  async paySalary(salaryId: number) {
    const salary = await this.prisma.salary.findUnique({
      where: { id: salaryId },
      include: {
        employee: {
          include: { user: true }
        }
      }
    });

    if (!salary) {
      throw new NotFoundException('Salary not found');
    }

    if (salary.status === 'PAID') {
      throw new Error('Salary already paid');
    }

    return this.prisma.$transaction(async (tx) => {
      // به‌روزرسانی وضعیت حقوق
      const updatedSalary = await tx.salary.update({
        where: { id: salaryId },
        data: { status: 'PAID' }
      });

      // ایجاد تراکنش پرداخت
      await tx.transaction.create({
        data: {
          type: 'EXPENSE',
          amount: BigInt(Math.floor(salary.amount * 10)), // Convert to Rials
          paymentMethod: 'CASH',
          sourceType: 'SALARY',
          sourceId: salaryId,
          employeeId: salary.employeeId,
          description: `پرداخت حقوق ${salary.employee.user.name}`,
          occurredAt: new Date()
        }
      });

      return updatedSalary;
    });
  }

  /**
   * دریافت لیست حقوق‌های پرداخت‌نشده
   */
  async getUnpaidSalaries() {
    return this.prisma.salary.findMany({
      where: { status: 'PENDING' },
      include: {
        employee: {
          include: { user: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * دریافت لیست حقوق‌های پرداخت‌شده
   */
  async getPaidSalaries() {
    return this.prisma.salary.findMany({
      where: { status: 'PAID' },
      include: {
        employee: {
          include: { user: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * دریافت تاریخچه حقوق کارمند
   */
  async getEmployeeSalaryHistory(employeeId: number) {
    return this.prisma.salary.findMany({
      where: { employeeId },
      include: {
        employee: {
          include: { user: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * دریافت آمار حقوق
   */
  async getSalaryStats() {
    const [totalSalaries, paidSalaries, pendingSalaries] = await Promise.all([
      this.prisma.salary.aggregate({
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.salary.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true },
        _count: true
      }),
      this.prisma.salary.aggregate({
        where: { status: 'PENDING' },
        _sum: { amount: true },
        _count: true
      })
    ]);

    return {
      totalAmount: totalSalaries._sum.amount || 0,
      totalCount: totalSalaries._count,
      paidAmount: paidSalaries._sum.amount || 0,
      paidCount: paidSalaries._count,
      pendingAmount: pendingSalaries._sum.amount || 0,
      pendingCount: pendingSalaries._count
    };
  }
}