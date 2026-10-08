/**
 * Phase 4 one-off. NOT a migration and NOT run by deploy.
 *
 * Lists OPEN appointments whose service snapshot is exactly 10× the current
 * catalog price (the removed double conversion). Settled, paid, cancelled,
 * and financially locked rows are never selected.
 *
 * Default is dry-run. Writing requires APPLY=1.
 *
 *   npx ts-node --transpile-only scripts/correct-open-appointment-prices.ts
 *   APPLY=1 npx ts-node --transpile-only scripts/correct-open-appointment-prices.ts
 */
import { PrismaClient } from '@prisma/client';

const OPEN_STATUSES = ['PENDING', 'PENDING_CONFIRMATION', 'CONFIRMED'] as const;

type Snapshot = {
  serviceId?: number;
  priceAtBooking?: number;
  durationMin?: number;
  serviceName?: string;
};

async function main() {
  const apply = process.env.APPLY === '1';
  const prisma = new PrismaClient();
  try {
    const services = await prisma.service.findMany({
      select: { id: true, price: true },
    });
    const priceById = new Map(services.map((row) => [row.id, row.price]));
    const appointments = await prisma.appointment.findMany({
      where: {
        deletedAt: null,
        financiallyLockedAt: null,
        status: { in: [...OPEN_STATUSES] },
      },
      select: { id: true, status: true, services: true },
      orderBy: { id: 'asc' },
    });

    const candidates: Array<{ id: number; status: string; serviceId: number; from: number; to: number }> = [];
    for (const appointment of appointments) {
      const snapshot = Array.isArray(appointment.services)
        ? (appointment.services as Snapshot[])
        : [];
      for (const row of snapshot) {
        const catalog = row.serviceId != null ? priceById.get(row.serviceId) : undefined;
        const booked = Number(row.priceAtBooking);
        if (catalog == null || !Number.isFinite(booked) || catalog <= 0) continue;
        if (booked === Math.floor(catalog * 10)) {
          candidates.push({
            id: appointment.id,
            status: appointment.status,
            serviceId: row.serviceId!,
            from: booked,
            to: Math.floor(catalog),
          });
        }
      }
    }

    console.log(JSON.stringify({
      apply,
      openScanned: appointments.length,
      candidateCount: candidates.length,
      candidates,
    }, null, 2));

    if (!apply || candidates.length === 0) {
      console.log(apply ? 'nothing to update' : 'dry-run only; set APPLY=1 to update the listed open rows');
      return;
    }

    for (const appointment of appointments) {
      const snapshot = Array.isArray(appointment.services)
        ? (appointment.services as Snapshot[])
        : [];
      let changed = false;
      const next = snapshot.map((row) => {
        const catalog = row.serviceId != null ? priceById.get(row.serviceId) : undefined;
        const booked = Number(row.priceAtBooking);
        if (catalog != null && booked === Math.floor(catalog * 10)) {
          changed = true;
          return { ...row, priceAtBooking: Math.floor(catalog) };
        }
        return row;
      });
      if (!changed) continue;
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { services: next as object },
      });
    }
    console.log(`updated ${candidates.length} snapshot rows`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'price correction failed');
  process.exit(1);
});
