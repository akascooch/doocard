import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(startDate: Date, endDate: Date) {
    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        customer: true,
        barber: true,
        services: { include: { service: true } },
      },
    });

    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(
      (apt) => apt.status === AppointmentStatus.COMPLETED,
    ).length;
    const cancelledAppointments = appointments.filter(
      (apt) => apt.status === AppointmentStatus.CANCELLED,
    ).length;

    const appointmentsByStatus = {
      [AppointmentStatus.PENDING]: appointments.filter(
        (apt) => apt.status === AppointmentStatus.PENDING,
      ).length,
      [AppointmentStatus.CONFIRMED]: appointments.filter(
        (apt) => apt.status === AppointmentStatus.CONFIRMED,
      ).length,
      [AppointmentStatus.COMPLETED]: completedAppointments,
      [AppointmentStatus.CANCELLED]: cancelledAppointments,
    };

    const revenue = appointments.reduce((total, apt) => {
      if (apt.status === AppointmentStatus.COMPLETED) {
        return total + apt.services.reduce((sum, s) => sum + (s.service?.price || 0), 0);
      }
      return total;
    }, 0);

    // topServices بر اساس appointmentService
    const topServicesRaw = await this.prisma.appointmentService.groupBy({
      by: ['serviceId'],
      _count: { serviceId: true },
      _sum: { price: true },
      orderBy: { _count: { serviceId: 'desc' } },
      where: {
        appointment: {
          date: { gte: startDate, lte: endDate },
          status: AppointmentStatus.COMPLETED,
        },
      },
      take: 5,
    });
    const servicesStats = await Promise.all(
      topServicesRaw.map(async (item) => {
        const service = await this.prisma.service.findUnique({ where: { id: item.serviceId } });
        return {
          name: service?.name,
          count: item._count.serviceId,
          revenue: item._sum.price,
        };
      })
    );

    // topBarbers
    const topBarbers = await this.prisma.barber.findMany({
      include: {
        appointments: {
          where: {
            date: { gte: startDate, lte: endDate },
            status: AppointmentStatus.COMPLETED,
          },
          include: { services: { include: { service: true } } },
        },
      },
    });
    const barberStats = topBarbers.map((barber) => ({
      name: `${barber.firstName} ${barber.lastName}`,
      appointments: barber.appointments.length,
      revenue: barber.appointments.reduce(
        (total, apt) => total + apt.services.reduce((sum, s) => sum + (s.service?.price || 0), 0),
        0,
      ),
    }));

    return {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      appointmentsByStatus,
      revenue,
      servicesStats,
      barberStats,
    };
  }

  async getAppointmentStats() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        services: { include: { service: true } },
      },
    });

    const dailyStats = new Array(endOfMonth.getDate()).fill(0);
    let totalRevenue = 0;

    appointments.forEach(appointment => {
      const day = appointment.date.getDate() - 1;
      const revenue = appointment.services.reduce((sum, s) => sum + (s.service?.price || 0), 0);
      dailyStats[day] += revenue;
      totalRevenue += revenue;
    });

    return {
      dailyStats,
      totalRevenue,
      totalAppointments: appointments.length,
    };
  }

  async getRevenue() {
    const appointments = await this.prisma.appointment.findMany({
      include: {
        services: { include: { service: true } },
      },
    });

    const revenue = appointments.reduce((total, appointment) => {
      return total + appointment.services.reduce((sum, s) => sum + (s.service?.price || 0), 0);
    }, 0);

    return { revenue };
  }

  async getPopularServices() {
    const services = await this.prisma.appointmentService.groupBy({
      by: ['serviceId'],
      _count: { serviceId: true },
      orderBy: { _count: { serviceId: 'desc' } },
      take: 5,
    });
    const popularServices = await Promise.all(
      services.map(async (service) => {
        const serviceDetails = await this.prisma.service.findUnique({
          where: { id: service.serviceId },
        });
        return {
          ...serviceDetails,
          count: service._count.serviceId,
        };
      }),
    );
    return { services: popularServices };
  }

  async getSummary() {
    const [
      totalAppointments,
      totalCustomers,
      totalBarbers,
      totalServices,
    ] = await Promise.all([
      this.prisma.appointment.count(),
      this.prisma.customer.count(),
      this.prisma.barber.count(),
      this.prisma.service.count(),
    ]);

    return {
      totalAppointments,
      totalCustomers,
      totalBarbers,
      totalServices,
    };
  }

  async getAppointmentsByDay() {
    const appointments = await this.prisma.appointment.groupBy({
      by: ['date'],
      _count: {
        id: true,
      },
      orderBy: {
        date: 'asc',
      },
      take: 7,
    });

    return {
      appointments: appointments.map((app) => ({
        date: app.date,
        count: app._count.id,
      })),
    };
  }
}
