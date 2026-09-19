import { Injectable } from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getJalaliMonthRanges } from '../common/utils/date-utils';

const SETTLED_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.COMPLETED,
  AppointmentStatus.PAID,
  AppointmentStatus.SETTLED,
];

export type TopCustomerMetric = 'spend' | 'visits' | 'points';

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTopCustomers(options: { year: number; limit?: number }) {
    const jy = options.year;
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 20);
    const ranges = getJalaliMonthRanges(jy);
    const start = ranges[0].start;
    const end = ranges[11].end;

    const groups = await this.prisma.appointment.groupBy({
      by: ['customerId'],
      where: {
        status: { in: SETTLED_STATUSES },
        deletedAt: null,
        paidAt: { not: null, gte: start, lte: end },
        amount: { not: null },
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const customerIds = groups.map((g) => g.customerId);
    const [customers, pointGroups] = await Promise.all([
      customerIds.length
        ? this.prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, user: { select: { name: true, phone: true } } },
          })
        : Promise.resolve([]),
      customerIds.length
        ? this.prisma.loyaltyPointTransaction.groupBy({
            by: ['customerId'],
            where: { customerId: { in: customerIds } },
            _sum: { points: true },
          })
        : Promise.resolve([]),
    ]);
    const nameById = new Map(
      customers.map((c) => [
        c.id,
        { name: c.user?.name ?? 'نامشخص', phone: c.user?.phone ?? null },
      ]),
    );
    const pointsById = new Map(pointGroups.map((g) => [g.customerId, g._sum.points ?? 0]));

    const items = groups.map((g) => ({
      customerId: g.customerId,
      name: nameById.get(g.customerId)?.name ?? 'نامشخص',
      phone: nameById.get(g.customerId)?.phone ?? null,
      visitCount: g._count.id,
      spendRial: String(g._sum.amount ?? 0),
      points: pointsById.get(g.customerId) ?? 0,
    }));

    const bySpend = [...items].sort((a, b) => {
      const diff = BigInt(b.spendRial) - BigInt(a.spendRial);
      return diff > 0n ? 1 : diff < 0n ? -1 : b.visitCount - a.visitCount;
    });
    const byVisits = [...items].sort((a, b) => b.visitCount - a.visitCount || Number(BigInt(b.spendRial) - BigInt(a.spendRial)));
    const byPoints = [...items].sort((a, b) => b.points - a.points || Number(BigInt(b.spendRial) - BigInt(a.spendRial)));

    return {
      year: jy,
      limit,
      spend: bySpend.slice(0, limit),
      visits: byVisits.slice(0, limit),
      points: byPoints.slice(0, limit),
    };
  }
}
