import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';
import { normalizeAppointmentFields } from '../common/utils/appointment-response.util';

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
        totalRevenue: totalRevenueResult._sum.amount || 0,
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

    const employeeIds = appointmentsByEmployeeRaw.map((e) => e.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { user: true },
    });
    const employeeMap = new Map(employees.map(e => [e.id, e.user.name]));

    const appointmentsByBarber = appointmentsByEmployeeRaw.map(item => ({
        barberName: employeeMap.get(item.employeeId) || 'نامشخص',
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
      totalRevenue: totalRevenueResult._sum.amount || 0,
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
      services.map(async (service) => {
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
      revenue: revenueResult._sum.amount || 0,
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
      services.map(async (service) => {
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

    const employeeIds = barbers.map(b => b.employeeId);
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      include: { user: true },
    });

    const employeeMap = new Map(employees.map(e => [e.id, e.user.name]));

    return barbers.map(barber => ({
      barberName: employeeMap.get(barber.employeeId) || 'نامشخص',
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
    return result._sum.amount || 0;
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
    const employee = await this.prisma.employee.findFirst({
      where: { 
        user: { email: currentUser.email }
      },
      include: { user: true }
    });

    if (!employee) {
      return {
        todayAppointments: 0,
        completedAppointments: 0,
        pendingAppointments: 0,
        monthlyEarnings: 0,
        totalCustomers: 0,
        averageRating: 0
      };
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const [
      todayAppointments,
      completedAppointments,
      pendingAppointments,
      monthlyEarnings,
      totalCustomers
    ] = await Promise.all([
      this.prisma.appointment.count({
        where: {
          employeeId: employee.id,
          scheduledAt: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
      }),
      this.prisma.appointment.count({
        where: {
          employeeId: employee.id,
          status: 'COMPLETED',
        },
      }),
      this.prisma.appointment.count({
        where: {
          employeeId: employee.id,
          status: 'PENDING',
        },
      }),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'SERVICE',
          appointment: {
            employeeId: employee.id,
          },
          createdAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      this.prisma.customer.count({
        where: { 
          appointments: {
            some: { employeeId: employee.id }
          }
        },
      })
    ]);

    return {
      todayAppointments,
      completedAppointments,
      pendingAppointments,
      monthlyEarnings: monthlyEarnings._sum.amount || 0,
      totalCustomers,
      averageRating: 4.8 // This would need to be calculated from reviews if available
    };
  }

  async getEmployeeTodayAppointments(currentUser: any) {
    const employee = await this.prisma.employee.findFirst({
      where: { 
        user: { email: currentUser.email }
      },
      include: { user: true }
    });

    if (!employee) {
      return [];
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return this.prisma.appointment.findMany({
      where: {
        employeeId: employee.id,
        scheduledAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: {
        customer: {
          include: { user: true }
        },
        service: true
      },
      orderBy: {
        scheduledAt: 'asc'
      }
    });
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
      totalSpent: totalSpent._sum.amount || 0
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