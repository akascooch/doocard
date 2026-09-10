import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';
import { normalizeAppointmentFields } from '../common/utils/appointment-response.util';
import { JALALI_MONTH_NAMES } from '../common/utils/date-utils';
import { formatJalaliFromUtcInstant } from '../common/utils/tehran-business-day';
import {
  BARBER_DONE_STATUSES,
  BARBER_PENDING_TODAY_STATUSES,
  getCurrentJalaliYearMonth,
  getJalaliMonthUtcRange,
  getJalaliYearUtcRange,
  getTehranTodayRange,
  netRialToString,
  parseServiceSnapshots,
  resolveAuthUserId,
} from './employee-dashboard.util';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(currentUser?: any) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // اگر کارمند است، فقط آمار خودش را ببیند
    if (currentUser?.role === 'EMPLOYEE') {
      const employee = await this.prisma.employee.findFirst({
        where: { 
          user: { email: currentUser.email }
        },
        include: { user: true }
      });

      if (!employee) {
        return {
          totalAppointments: 0,
          totalCustomers: 0,
          totalEmployees: 1,
          totalServices: 0,
          newCustomersThisMonth: 0,
          appointmentsByEmployee: [],
          totalRevenue: 0,
          completionRate: 0,
          popularServices: [],
        };
      }

      const [
        totalAppointments,
        totalCustomers,
        totalServices,
        newCustomersThisMonth,
        totalRevenueResult,
      ] = await Promise.all([
        this.prisma.appointment.count({
          where: { employeeId: employee.id },
        }),
        this.prisma.customer.count({
          where: { 
            appointments: {
              some: { employeeId: employee.id }
            }
          },
        }),
        this.prisma.service.count(),
        this.prisma.customer.count({
          where: {
            createdAt: {
              gte: startOfMonth,
            },
            appointments: {
              some: { employeeId: employee.id }
            }
          },
        }),
        this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            type: 'SERVICE',
            appointment: {
              employeeId: employee.id,
            },
          },
        }),
      ]);

      const appointmentsByEmployee = [{
        barberName: employee.user.name,
        count: totalAppointments,
      }];

      const popularServices = await this.getPopularServices(currentUser);

      return {
        totalAppointments,
        totalCustomers,
        totalEmployees: 1,
        totalServices,
        newCustomersThisMonth,
        appointmentsByBarber: appointmentsByEmployee,
        // amount is BigInt in Prisma — must be Number before JSON serialization
        totalRevenue: Number(totalRevenueResult._sum.amount ?? 0),
        completionRate: 0,
        popularServices: popularServices.services || [],
      };
    }

    // برای ادمین، همه آمار
    const [
      totalAppointments,
      totalCustomers,
      totalEmployees,
      totalServices,
      newCustomersThisMonth,
      appointmentsByEmployeeRaw,
      totalRevenueResult,
    ] = await Promise.all([
      this.prisma.appointment.count(),
      this.prisma.customer.count(),
      this.prisma.employee.count(),
      this.prisma.service.count(),
      this.prisma.customer.count({
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),
      this.prisma.appointment.groupBy({
        by: ['employeeId'],
        _count: { id: true },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'SERVICE',
        },
      }),
    ]);

    // employeeId is nullable on appointments — null groups must not reach Prisma `in`
    const employeeIds = appointmentsByEmployeeRaw
      .map((e) => e.employeeId)
      .filter((id): id is number => id !== null && id !== undefined);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { user: true },
    });
    const employeeMap = new Map(employees.map(e => [e.id, e.user.name]));

    const appointmentsByBarber = appointmentsByEmployeeRaw.map(item => ({
        barberName: (item.employeeId != null && employeeMap.get(item.employeeId)) || 'نامشخص',
        count: item._count.id,
    }));

    const popularServices = await this.getPopularServices(currentUser);

    return {
      totalAppointments,
      totalCustomers,
      totalEmployees,
      totalServices,
      newCustomersThisMonth,
      appointmentsByBarber,
      totalRevenue: Number(totalRevenueResult._sum.amount ?? 0),
      completionRate: 0,
      popularServices: popularServices.services || [],
    };
  }

  async getPopularServices(currentUser?: any) {
    const whereClause: any = {};

    // اگر کارمند است، فقط خدمات نوبت‌های خودش را ببیند
    if (currentUser?.role === 'EMPLOYEE') {
      const employee = await this.prisma.employee.findFirst({
        where: { 
          user: { email: currentUser.email }
        },
        include: { user: true }
      });
      if (employee) {
        whereClause.appointment = {
          employeeId: employee.id,
        };
      }
    }

    const services = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      where: whereClause,
      take: 5,
    });

    const popularServices = await Promise.all(
      services
        // serviceId is nullable on appointments — skip null groups
        .filter((service) => service.serviceId !== null && service.serviceId !== undefined)
        .map(async (service) => {
          const serviceDetails = await this.prisma.service.findUnique({
            where: { id: service.serviceId },
          });
          return {
            serviceName: serviceDetails?.name || 'نامشخص',
            count: service._count.serviceId,
          };
        }),
    );

    return { services: popularServices };
  }

  async getAppointmentsByDay(currentUser?: any) {
    const whereClause: any = {};

    // اگر کارمند است، فقط نوبت‌های خودش را ببیند
    if (currentUser?.role === 'EMPLOYEE') {
      const employee = await this.prisma.employee.findFirst({
        where: { 
          user: { email: currentUser.email }
        },
        include: { user: true }
      });
      if (employee) {
        whereClause.employeeId = employee.id;
      }
    }

    // 7 روز اخیر
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 6);

    whereClause.scheduledAt = {
      gte: startDate,
      lte: endDate,
    };

    const appointments = await this.prisma.appointment.groupBy({
      by: ['scheduledAt'],
      _count: {
        id: true,
      },
      where: whereClause,
      orderBy: {
        scheduledAt: 'asc',
      },
    });

    // پر کردن روزهای خالی با صفر
    const appointmentsMap = new Map();
    appointments.forEach(app => {
      const dateStr = app.scheduledAt.toISOString().split('T')[0];
      appointmentsMap.set(dateStr, app._count.id);
    });

    const result = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      result.push({
        date: dateStr,
        count: appointmentsMap.get(dateStr) || 0,
      });
    }

    return {
      appointments: result,
    };
  }

  async getStats(startDate: Date, endDate: Date, currentUser?: any) {
    const whereClause: any = {
      scheduledAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // اگر کارمند است، فقط نوبت‌های خودش را ببیند
    if (currentUser?.role === 'EMPLOYEE') {
      const employee = await this.prisma.employee.findFirst({
        where: { 
          user: { email: currentUser.email }
        },
        include: { user: true }
      });
      if (employee) {
        whereClause.employeeId = employee.id;
      }
    }

    const [
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      appointmentsByStatus,
      revenueResult,
    ] = await Promise.all([
      this.prisma.appointment.count({ where: whereClause }),
      this.prisma.appointment.count({ 
        where: { ...whereClause, status: 'COMPLETED' } 
      }),
      this.prisma.appointment.count({ 
        where: { ...whereClause, status: 'CANCELLED' } 
      }),
      this.prisma.appointment.groupBy({
        by: ['status'],
        _count: { id: true },
        where: whereClause,
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'SERVICE',
          appointment: whereClause,
        },
      }),
    ]);

    const servicesStats = await this.getServicesStats(whereClause);
    const barberStats = await this.getBarberStats(whereClause);

    return {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      appointmentsByStatus: appointmentsByStatus.reduce((acc, item) => {
        acc[item.status] = item._count.id;
        return acc;
      }, {}),
      revenue: Number(revenueResult._sum.amount ?? 0),
      servicesStats,
      barberStats,
    };
  }

  async getAppointmentStats(currentUser?: any) {
    return {
      dailyStats: [],
      totalRevenue: 0,
      totalAppointments: 0,
    };
  }

  async getRevenue(currentUser?: any) {
    return { revenue: 0 };
  }

  async getCustomerAppointmentsChart(currentUser?: any) {
    return { customers: [] };
  }

  private async getServicesStats(whereClause: any) {
    const services = await this.prisma.appointment.groupBy({
      by: ['serviceId'],
      _count: { id: true },
      where: whereClause,
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    const serviceDetails = await Promise.all(
      services
        // serviceId is nullable on appointments — skip null groups
        .filter((service) => service.serviceId !== null && service.serviceId !== undefined)
        .map(async (service) => {
          const serviceInfo = await this.prisma.service.findUnique({
            where: { id: service.serviceId },
          });
          return {
            serviceName: serviceInfo?.name || 'نامشخص',
            count: service._count.id,
            revenue: 0, // Will be calculated separately if needed
          };
        })
    );

    return serviceDetails;
  }

  private async getBarberStats(whereClause: any) {
    const barbers = await this.prisma.appointment.groupBy({
      by: ['employeeId'],
      _count: { id: true },
      where: whereClause,
      orderBy: { _count: { id: 'desc' } },
    });

    // employeeId is nullable on appointments — null groups must not reach Prisma `in`
    const employeeIds = barbers
      .map((b) => b.employeeId)
      .filter((id): id is number => id !== null && id !== undefined);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { user: true },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e.user.name]));

    return barbers.map(barber => ({
      barberName: (barber.employeeId != null && employeeMap.get(barber.employeeId)) || 'نامشخص',
      count: barber._count.id,
    }));
  }

  // Admin dashboard specific methods
  async getTotalCustomers() {
    return this.prisma.customer.count();
  }

  async getTotalEmployees() {
    return this.prisma.employee.count();
  }

  async getTotalAppointments() {
    return this.prisma.appointment.count();
  }

  async getTotalRevenue() {
    const result = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { type: 'SERVICE' },
    });
    return Number(result._sum.amount ?? 0);
  }

  async getPendingAppointments() {
    return this.prisma.appointment.count({
      where: { status: 'PENDING' },
    });
  }

  async getCompletedAppointments() {
    return this.prisma.appointment.count({
      where: { status: 'COMPLETED' },
    });
  }

  async getTodayAppointments() {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return this.prisma.appointment.count({
      where: {
        scheduledAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });
  }

  // Admin dashboard stats
  async getAdminStats() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [
      totalAppointments,
      todayAppointments,
      totalCustomers,
      totalEmployees,
      monthlyRevenue,
      pendingAppointments,
      completedAppointments
    ] = await Promise.all([
      this.getTotalAppointments(),
      this.getTodayAppointments(),
      this.getTotalCustomers(),
      this.getTotalEmployees(),
      this.getMonthlyRevenue(startOfMonth, endOfMonth),
      this.getPendingAppointments(),
      this.getCompletedAppointments()
    ]);

    return {
      totalAppointments,
      todayAppointments,
      totalCustomers,
      totalEmployees,
      monthlyRevenue,
      pendingAppointments,
      completedAppointments
    };
  }

  async getMonthlyRevenue(startDate: Date, endDate: Date) {
    // محاسبه درآمد از نوبت‌ها (appointments.amount)
    const appointmentsRevenue = await this.prisma.appointment.aggregate({
      _sum: { amount: true },
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        deletedAt: null,
        amount: { not: null }, // فقط نوبت‌هایی که مبلغ دارند
      },
    });

    // درآمدهای دیگر (INCOME transactions)
    const otherIncome = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'INCOME',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // هزینه‌ها (EXPENSE transactions)
    const expenses = await this.prisma.transaction.aggregate({
      _sum: { amount: true },
      where: {
        type: 'EXPENSE',
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // محاسبه سود خالص: (درآمد نوبت‌ها + درآمدهای دیگر) - هزینه‌ها
    const totalRevenue = Number(appointmentsRevenue._sum.amount || 0) + Number(otherIncome._sum.amount || 0);
    const totalExpenses = Number(expenses._sum.amount || 0);
    const netProfit = totalRevenue - totalExpenses;

    return netProfit; // سود خالص (در ریال)
  }

  // Employee dashboard stats
  async getEmployeeStats(currentUser: any) {
    const empty = {
      todayAppointments: 0,
      todayCompletedAppointments: 0,
      todayPendingAppointments: 0,
      completedAppointments: 0,
      pendingAppointments: 0,
      monthlyNetEarningsRial: '0',
      monthlyEarnings: 0,
      totalCustomers: 0,
      averageRating: null as number | null,
    };

    const userId = resolveAuthUserId(currentUser);
    if (!userId) return empty;

    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) return empty;

    const today = getTehranTodayRange();
    const { jy, jm } = getCurrentJalaliYearMonth();
    const month = getJalaliMonthUtcRange(jy, jm);

    const [
      todayAppointments,
      todayCompletedAppointments,
      todayPendingAppointments,
      monthlyNet,
      totalCustomers,
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: {
          employeeId: employee.id,
          deletedAt: null,
          scheduledAt: { gte: today.start, lt: today.endExclusive },
        },
      }),
      this.prisma.appointment.count({
        where: {
          employeeId: employee.id,
          deletedAt: null,
          status: { in: BARBER_DONE_STATUSES },
          scheduledAt: { gte: today.start, lt: today.endExclusive },
        },
      }),
      this.prisma.appointment.count({
        where: {
          employeeId: employee.id,
          deletedAt: null,
          status: { in: BARBER_PENDING_TODAY_STATUSES },
          scheduledAt: { gte: today.start, lt: today.endExclusive },
        },
      }),
      this.prisma.appointment.aggregate({
        _sum: { barberPayoutNetAmount: true },
        where: {
          employeeId: employee.id,
          deletedAt: null,
          status: { in: BARBER_DONE_STATUSES },
          barberPayoutNetAmount: { not: null },
          scheduledAt: { gte: month.start, lte: month.end },
        },
      }),
      this.prisma.customer.count({
        where: {
          appointments: {
            some: { employeeId: employee.id, deletedAt: null },
          },
        },
      }),
    ]);

    const monthlyNetEarningsRial = netRialToString(
      monthlyNet._sum.barberPayoutNetAmount,
    );
    const netBig = monthlyNet._sum.barberPayoutNetAmount ?? 0n;
    const monthlyEarningsToman = Number(netBig / 10n);

    return {
      todayAppointments,
      todayCompletedAppointments,
      todayPendingAppointments,
      completedAppointments: todayCompletedAppointments,
      pendingAppointments: todayPendingAppointments,
      monthlyNetEarningsRial,
      monthlyEarnings: monthlyEarningsToman,
      totalCustomers,
      averageRating: null,
    };
  }

  async getEmployeeTodayAppointments(currentUser: any) {
    const userId = resolveAuthUserId(currentUser);
    if (!userId) return [];

    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) return [];

    const today = getTehranTodayRange();
    const rows = await this.prisma.appointment.findMany({
      where: {
        employeeId: employee.id,
        deletedAt: null,
        scheduledAt: { gte: today.start, lt: today.endExclusive },
      },
      include: {
        customer: { include: { user: true } },
        service: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return rows.map((appointment) => {
      const snapshots = parseServiceSnapshots(appointment.services);
      const serviceName =
        snapshots.map((s) => s.serviceName).join('، ') ||
        appointment.service?.name ||
        'خدمت';
      return {
        id: appointment.id,
        scheduledAt: appointment.scheduledAt,
        appointmentDate: appointment.scheduledAt,
        status: appointment.status,
        durationMin: appointment.durationMin,
        serviceName,
        customerName: appointment.customer?.user?.name || 'مشتری',
        customerPhone: appointment.customer?.user?.phone || '',
        service: {
          name: serviceName,
          durationMinutes: appointment.durationMin,
        },
        customer: {
          user: {
            name: appointment.customer?.user?.name || 'مشتری',
            phone: appointment.customer?.user?.phone || '',
          },
        },
      };
    });
  }

  /**
   * Employee-scoped performance (Jalali). Does not reuse admin yearly-report.
   * Net earnings = SUM(barberPayoutNetAmount) on done appointments — settlement snapshot,
   * not salon SERVICE transactions and not payroll netPayable (withdrawals excluded).
   */
  async getEmployeePerformance(currentUser: any, yearParam?: string) {
    const userId = resolveAuthUserId(currentUser);
    if (!userId) {
      throw new ForbiddenException('Employee profile not found');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { userId },
    });
    if (!employee) {
      throw new ForbiddenException('Employee profile not found');
    }

    const { jy: currentJalaliYear } = getCurrentJalaliYearMonth();
    const parsed = yearParam ? parseInt(yearParam, 10) : currentJalaliYear;
    const selectedJalaliYear =
      Number.isInteger(parsed) && parsed >= 1300 && parsed <= 1500
        ? parsed
        : currentJalaliYear;

    const years = Array.from({ length: 5 }, (_, i) => currentJalaliYear - 4 + i);
    const spanStart = getJalaliYearUtcRange(years[0]).start;
    const spanEnd = getJalaliYearUtcRange(years[years.length - 1]).end;

    const rows = await this.prisma.appointment.findMany({
      where: {
        employeeId: employee.id,
        deletedAt: null,
        scheduledAt: { gte: spanStart, lte: spanEnd },
      },
      select: {
        status: true,
        customerId: true,
        scheduledAt: true,
        barberPayoutNetAmount: true,
        services: true,
        calendarDate: { select: { jalaliYear: true, jalaliMonth: true } },
      },
    });

    const yearBuckets = new Map<
      number,
      { completedCount: number; cancelledCount: number; customers: Set<number>; net: bigint }
    >();
    const monthBuckets = new Map<
      number,
      { completedCount: number; customers: Set<number>; net: bigint }
    >();
    for (let m = 1; m <= 12; m++) {
      monthBuckets.set(m, { completedCount: 0, customers: new Set(), net: 0n });
    }
    const serviceStats = new Map<string, { count: number; grossRial: number }>();

    let completedCount = 0;
    let cancelledCount = 0;
    const allCustomers = new Set<number>();
    let netAll = 0n;

    for (const row of rows) {
      const jalali = row.calendarDate
        ? { jy: row.calendarDate.jalaliYear, jm: row.calendarDate.jalaliMonth }
        : (() => {
            const [jy, jm] = formatJalaliFromUtcInstant(row.scheduledAt)
              .split('/')
              .map(Number);
            return { jy, jm };
          })();

      if (!yearBuckets.has(jalali.jy)) {
        yearBuckets.set(jalali.jy, {
          completedCount: 0,
          cancelledCount: 0,
          customers: new Set(),
          net: 0n,
        });
      }
      const yb = yearBuckets.get(jalali.jy)!;
      const isDone = BARBER_DONE_STATUSES.includes(row.status);
      const isCancelled = row.status === AppointmentStatus.CANCELLED;
      const net = row.barberPayoutNetAmount ?? 0n;

      if (isDone) {
        completedCount += 1;
        allCustomers.add(row.customerId);
        netAll += net;
        yb.completedCount += 1;
        yb.customers.add(row.customerId);
        yb.net += net;
        if (jalali.jy === selectedJalaliYear) {
          const mb = monthBuckets.get(jalali.jm);
          if (mb) {
            mb.completedCount += 1;
            mb.customers.add(row.customerId);
            mb.net += net;
          }
          for (const snap of parseServiceSnapshots(row.services)) {
            const existing = serviceStats.get(snap.serviceName) || {
              count: 0,
              grossRial: 0,
            };
            existing.count += 1;
            existing.grossRial += snap.priceAtBooking;
            serviceStats.set(snap.serviceName, existing);
          }
        }
      } else if (isCancelled) {
        cancelledCount += 1;
        yb.cancelledCount += 1;
      }
    }

    return {
      currentJalaliYear,
      selectedJalaliYear,
      summary: {
        completedCount,
        cancelledCount,
        uniqueCustomers: allCustomers.size,
        netEarningsRial: netRialToString(netAll),
      },
      years: years.map((year) => {
        const bucket = yearBuckets.get(year);
        return {
          year,
          completedCount: bucket?.completedCount ?? 0,
          cancelledCount: bucket?.cancelledCount ?? 0,
          uniqueCustomers: bucket?.customers.size ?? 0,
          netEarningsRial: netRialToString(bucket?.net ?? 0n),
        };
      }),
      months: Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const bucket = monthBuckets.get(month)!;
        return {
          month,
          monthName: JALALI_MONTH_NAMES[month],
          completedCount: bucket.completedCount,
          uniqueCustomers: bucket.customers.size,
          netEarningsRial: netRialToString(bucket.net),
        };
      }),
      topServices: [...serviceStats.entries()]
        .sort((a, b) => b[1].count - a[1].count || b[1].grossRial - a[1].grossRial)
        .slice(0, 8)
        .map(([name, stat]) => ({
          name,
          count: stat.count,
          grossRial: String(stat.grossRial),
        })),
    };
  }

  // Customer dashboard stats
  async getCustomerStats(currentUser: any) {
    /**
     * SECURITY FIX:
     * Customer must be resolved by userId instead of email.
     * Email is optional and not a reliable identity key.
     */
    const customer = await this.prisma.customer.findUnique({
      where: { userId: currentUser.id },
      include: { user: true },
    });

    if (!customer) {
      throw new ForbiddenException('Customer profile not found');
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [
      totalAppointments,
      todayAppointments,
      upcomingAppointments,
      completedAppointments,
      totalSpent
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: { customerId: customer.id }
      }),
      this.prisma.appointment.count({
        where: {
          customerId: customer.id,
          scheduledAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        }
      }),
      this.prisma.appointment.count({
        where: {
          customerId: customer.id,
          scheduledAt: { gte: today },
          status: { in: ['PENDING', 'CONFIRMED'] }
        }
      }),
      this.prisma.appointment.count({
        where: {
          customerId: customer.id,
          status: 'COMPLETED'
        }
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'SERVICE',
          appointment: { customerId: customer.id }
        }
      })
    ]);

    return {
      totalAppointments,
      todayAppointments,
      upcomingAppointments,
      completedAppointments,
      totalSpent: Number(totalSpent._sum.amount ?? 0)
    };
  }

  async getCustomerUpcomingAppointments(currentUser: any) {
    /**
     * SECURITY FIX:
     * Customer must be resolved by userId instead of email.
     * Email is optional and not a reliable identity key.
     */
    const customer = await this.prisma.customer.findUnique({
      where: { userId: currentUser.id },
      include: { user: true },
    });

    if (!customer) {
      throw new ForbiddenException('Customer profile not found');
    }

    const today = new Date();

    const appointments = await this.prisma.appointment.findMany({
      where: {
        customerId: customer.id,
        scheduledAt: { gte: today },
        status: { in: ['PENDING', 'CONFIRMED'] }
      },
      include: {
        service: true,
        employee: {
          include: { user: true }
        }
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5
    });

    return appointments.map((appointment) => ({
      ...appointment,
      ...normalizeAppointmentFields(appointment),
    }));
  }

  // Financial dashboard stats
  async getFinancialStats() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [
      // درآمد کل از نوبت‌ها
      totalAppointmentsRevenue,
      monthlyAppointmentsRevenue,
      dailyAppointmentsRevenue,
      totalSettlementDeduction,
      monthlySettlementDeduction,
      dailySettlementDeduction,
      // درآمدهای دیگر (INCOME)
      totalOtherIncome,
      monthlyOtherIncome,
      dailyOtherIncome,
      // هزینه‌ها (EXPENSE)
      totalExpenses,
      monthlyExpenses,
      dailyExpenses,
      // آمار عمومی
      totalCustomers,
      totalAppointments,
      topServices,
      recentTransactions
    ] = await Promise.all([
      // کل درآمد نوبت‌ها (همه زمان‌ها)
      this.prisma.appointment.aggregate({
        _sum: { amount: true },
        where: { 
          deletedAt: null,
          amount: { not: null }
        }
      }),
      // درآمد نوبت‌های این ماه
      this.prisma.appointment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: startOfMonth },
          deletedAt: null,
          amount: { not: null }
        }
      }),
      // درآمد نوبت‌های امروز
      this.prisma.appointment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: { gte: startOfDay, lt: endOfDay },
          deletedAt: null,
          amount: { not: null }
        }
      }),
      // کسورات تسویه آرایشگر - کل
      this.prisma.appointment.aggregate({
        _sum: { settlementDeductionAmount: true },
        where: {
          deletedAt: null,
          settlementDeductionAmount: { not: null },
        },
      }),
      // کسورات تسویه آرایشگر - ماه جاری
      this.prisma.appointment.aggregate({
        _sum: { settlementDeductionAmount: true },
        where: {
          createdAt: { gte: startOfMonth },
          deletedAt: null,
          settlementDeductionAmount: { not: null },
        },
      }),
      // کسورات تسویه آرایشگر - امروز
      this.prisma.appointment.aggregate({
        _sum: { settlementDeductionAmount: true },
        where: {
          createdAt: { gte: startOfDay, lt: endOfDay },
          deletedAt: null,
          settlementDeductionAmount: { not: null },
        },
      }),
      // درآمدهای دیگر - کل
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'INCOME' }
      }),
      // درآمدهای دیگر - این ماه
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'INCOME',
          createdAt: { gte: startOfMonth }
        }
      }),
      // درآمدهای دیگر - امروز
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'INCOME',
          createdAt: { gte: startOfDay, lt: endOfDay }
        }
      }),
      // هزینه‌ها - کل
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { type: 'EXPENSE' }
      }),
      // هزینه‌ها - این ماه
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'EXPENSE',
          createdAt: { gte: startOfMonth }
        }
      }),
      // هزینه‌ها - امروز
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'EXPENSE',
          createdAt: { gte: startOfDay, lt: endOfDay }
        }
      }),
      this.prisma.customer.count(),
      this.prisma.appointment.count({ where: { deletedAt: null } }),
      this.prisma.service.findMany({
        include: {
          appointments: {
            where: {
              createdAt: { gte: startOfMonth },
              deletedAt: null
            }
          }
        },
        orderBy: {
          appointments: { _count: 'desc' }
        },
        take: 5
      }),
      this.prisma.transaction.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          category: true,
          account: true
        }
      })
    ]);

    // All Prisma _sum.amount and entity.amount are BigInt — convert to number/string so JSON never sees BigInt
    const sumAppointments = (v: bigint | null | undefined) => Number(v ?? 0);
    const sumTransactions = (v: bigint | null | undefined) => Number(v ?? 0);

    const totalRevenue = sumAppointments(totalAppointmentsRevenue._sum.amount) + sumTransactions(totalOtherIncome._sum.amount);
    const monthlyRevenue = sumAppointments(monthlyAppointmentsRevenue._sum.amount) + sumTransactions(monthlyOtherIncome._sum.amount);
    const dailyRevenue = sumAppointments(dailyAppointmentsRevenue._sum.amount) + sumTransactions(dailyOtherIncome._sum.amount);

    const totalExpensesNum = sumTransactions(totalExpenses._sum.amount);
    const monthlyExpensesNum = sumTransactions(monthlyExpenses._sum.amount);
    const dailyExpensesNum = sumTransactions(dailyExpenses._sum.amount);

    const netProfit = totalRevenue - totalExpensesNum;
    const monthlyNetProfit = monthlyRevenue - monthlyExpensesNum;
    const dailyNetProfit = dailyRevenue - dailyExpensesNum;

    const averageAppointmentValue = totalAppointments > 0
      ? sumAppointments(totalAppointmentsRevenue._sum.amount) / totalAppointments
      : 0;
    const totalSettlementDeductionAmount = sumAppointments(totalSettlementDeduction._sum.settlementDeductionAmount);
    const monthlySettlementDeductionAmount = sumAppointments(monthlySettlementDeduction._sum.settlementDeductionAmount);
    const dailySettlementDeductionAmount = sumAppointments(dailySettlementDeduction._sum.settlementDeductionAmount);

    return {
      totalRevenue,
      monthlyRevenue,
      dailyRevenue,
      totalExpenses: totalExpensesNum,
      monthlyExpenses: monthlyExpensesNum,
      dailyExpenses: dailyExpensesNum,
      netProfit,
      monthlyNetProfit,
      dailyNetProfit,
      totalCustomers,
      totalAppointments,
      totalSettlementDeductionAmount,
      monthlySettlementDeductionAmount,
      dailySettlementDeductionAmount,
      averageAppointmentValue,
      topServices: topServices.map(service => ({
        name: service.name,
        revenue: service.appointments.reduce((sum, apt) => {
          const amount = apt.amount != null ? Number(apt.amount) : (service.price ?? 0);
          return sum + amount;
        }, 0),
        bookings: service.appointments.length
      })),
      recentTransactions: recentTransactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount != null ? String(transaction.amount) : '0',
        description: transaction.category?.name || 'تراکنش',
        date: transaction.createdAt.toISOString().split('T')[0],
        category: transaction.type === 'INCOME' ? 'درآمد' : 'هزینه',
        account: transaction.account?.name || 'نامشخص'
      }))
    };
  }
}