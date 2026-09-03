import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getRevenue() {
    const result = await this.prisma.transaction.aggregate({
      where: { type: 'income' },
      _sum: { amount: true },
    });
    return { totalRevenue: result._sum.amount || 0 };
  }

  async getAppointmentsCount() {
    const total = await this.prisma.appointment.count();
    const pending = await this.prisma.appointment.count({ where: { status: 'pending' } });
    const confirmed = await this.prisma.appointment.count({ where: { status: 'confirmed' } });
    const completed = await this.prisma.appointment.count({ where: { status: 'completed' } });

    return { total, pending, confirmed, completed };
  }

  async getPopularServices() {
    const result = await this.prisma.appointmentService.groupBy({
      by: ['serviceId'],
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    });

    const serviceIds = result.map(r => r.serviceId);
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds } },
    });

    return services.map(service => ({
      ...service,
      usageCount: result.find(r => r.serviceId === service.id)?._count.serviceId || 0,
    }));
  }

  async getSummary() {
    const [revenue, appointments, popular] = await Promise.all([
      this.getRevenue(),
      this.getAppointmentsCount(),
      this.getPopularServices(),
    ]);

    return { ...revenue, ...appointments, popularServices: popular };
  }

  async getAppointmentsByDay(from?: string, to?: string) {
    const where: any = {};

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const result = await this.prisma.appointment.groupBy({
      by: ['date'],
      where,
      _count: { id: true },
      orderBy: { date: 'asc' },
    });

    return result.map(r => ({
      date: r.date.toISOString().split('T')[0],
      count: r._count.id,
    }));
  }
}
