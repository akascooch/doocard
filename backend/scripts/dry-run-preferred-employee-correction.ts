/**
 * DRY-RUN ONLY — does not update any rows.
 *
 * Finds customers with preferredEmployeeId IS NULL ("Salon Team" in UI),
 * suggests the most-frequent appointment barber (majority vote).
 *
 * Usage (from Backend/):
 *   npx ts-node --transpile-only scripts/dry-run-preferred-employee-correction.ts
 *
 * Optional:
 *   OUT_JSON=./preferred-employee-dry-run.json npx ts-node --transpile-only scripts/dry-run-preferred-employee-correction.ts
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

type Suggestion = {
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  currentOwner: 'Salon Team';
  suggestedOwner: string | null;
  suggestedEmployeeId: number | null;
  appointmentCount: number;
  status:
    | 'suggested'
    | 'no_appointment_history'
    | 'tie_ambiguous'
    | 'employee_inactive';
  note?: string;
};

async function main() {
  const prisma = new PrismaClient();
  const startedAt = new Date().toISOString();

  try {
    const nullPreferred = await prisma.customer.findMany({
      where: { preferredEmployeeId: null },
      include: {
        user: { select: { name: true, phone: true } },
      },
      orderBy: { id: 'asc' },
    });

    const suggestions: Suggestion[] = [];

    for (const customer of nullPreferred) {
      const rows = await prisma.appointment.groupBy({
        by: ['employeeId'],
        where: {
          customerId: customer.id,
          deletedAt: null,
          employeeId: { not: null },
          status: { not: 'CANCELLED' },
        },
        _count: { _all: true },
        _max: { scheduledAt: true },
      });

      const ranked = rows
        .filter((r) => r.employeeId != null)
        .map((r) => ({
          employeeId: r.employeeId as number,
          count: r._count._all,
          lastAt: r._max.scheduledAt,
        }))
        .sort((a, b) => {
          if (b.count !== a.count) return b.count - a.count;
          const at = (b.lastAt?.getTime() || 0) - (a.lastAt?.getTime() || 0);
          return at;
        });

      if (ranked.length === 0) {
        suggestions.push({
          customerId: customer.id,
          customerName: customer.user?.name || '—',
          customerPhone: customer.user?.phone ?? null,
          currentOwner: 'Salon Team',
          suggestedOwner: null,
          suggestedEmployeeId: null,
          appointmentCount: 0,
          status: 'no_appointment_history',
          note: 'No non-cancelled appointments with an employeeId',
        });
        continue;
      }

      const top = ranked[0];
      const tied = ranked.filter((r) => r.count === top.count);
      if (tied.length > 1) {
        suggestions.push({
          customerId: customer.id,
          customerName: customer.user?.name || '—',
          customerPhone: customer.user?.phone ?? null,
          currentOwner: 'Salon Team',
          suggestedOwner: null,
          suggestedEmployeeId: null,
          appointmentCount: top.count,
          status: 'tie_ambiguous',
          note: `Tie between employeeIds: ${tied
            .map((t) => t.employeeId)
            .join(', ')}`,
        });
        continue;
      }

      const emp = await prisma.employee.findUnique({
        where: { id: top.employeeId },
        include: { user: { select: { name: true } } },
      });

      if (!emp || !emp.isActive) {
        suggestions.push({
          customerId: customer.id,
          customerName: customer.user?.name || '—',
          customerPhone: customer.user?.phone ?? null,
          currentOwner: 'Salon Team',
          suggestedOwner: emp?.user?.name ?? null,
          suggestedEmployeeId: top.employeeId,
          appointmentCount: top.count,
          status: 'employee_inactive',
          note: 'Top barber missing or inactive — do not auto-apply',
        });
        continue;
      }

      suggestions.push({
        customerId: customer.id,
        customerName: customer.user?.name || '—',
        customerPhone: customer.user?.phone ?? null,
        currentOwner: 'Salon Team',
        suggestedOwner: emp.user?.name || `Employee #${emp.id}`,
        suggestedEmployeeId: emp.id,
        appointmentCount: top.count,
        status: 'suggested',
      });
    }

    const summary = {
      dryRun: true,
      appliedUpdates: false,
      startedAt,
      finishedAt: new Date().toISOString(),
      totalNullPreferred: nullPreferred.length,
      suggestedCount: suggestions.filter((s) => s.status === 'suggested').length,
      noHistoryCount: suggestions.filter(
        (s) => s.status === 'no_appointment_history',
      ).length,
      tieCount: suggestions.filter((s) => s.status === 'tie_ambiguous').length,
      inactiveCount: suggestions.filter((s) => s.status === 'employee_inactive')
        .length,
      // Compact rows matching the requested shape
      rows: suggestions.map((s) => ({
        customerName: s.customerName,
        currentOwner: s.currentOwner,
        suggestedOwner: s.suggestedOwner ?? '—',
        appointmentCount: s.appointmentCount,
        // Extra fields for operators (safe to ignore in UI)
        customerId: s.customerId,
        suggestedEmployeeId: s.suggestedEmployeeId,
        status: s.status,
        note: s.note,
      })),
    };

    const outPath =
      process.env.OUT_JSON ||
      path.join(
        process.cwd(),
        `preferred-employee-dry-run-${Date.now()}.json`,
      );
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(JSON.stringify(summary, null, 2));
    console.log(`\nWrote dry-run report to: ${outPath}`);
    console.log('NO DATABASE UPDATES WERE PERFORMED.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
