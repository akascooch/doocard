/**
 * READ-ONLY diagnostic: appointment tips vs ledger TIP rows for a Jalali day.
 * Usage (from /var/www/doocard/backend):
 *   node scripts/audit-tip-ledger-gap.js 1405/04/20
 */
const { PrismaClient } = require('@prisma/client');
const jalaali = require('jalaali-js');

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

function jalaliClosedRange(jstr) {
  const [jy, jm, jd] = jstr.split(/[\/\-]/).map(Number);
  const g = jalaali.toGregorian(jy, jm, jd);
  const start = new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0) - TEHRAN_OFFSET_MS);
  const end = new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 23, 59, 59, 999) - TEHRAN_OFFSET_MS);
  return { start, end };
}

function toman(rial) {
  return (BigInt(rial) / 10n).toString();
}

(async () => {
  const day = process.argv[2] || '1405/04/20';
  const { start, end } = jalaliClosedRange(day);
  const prisma = new PrismaClient();
  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        deletedAt: null,
        tipAmount: { not: null, gt: 0n },
        paidAt: { gte: start, lte: end },
        status: { in: ['SETTLED', 'PAID', 'COMPLETED'] },
      },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        employee: { include: { user: { select: { name: true, role: true } } } },
        tipRecipientEmployee: { include: { user: { select: { name: true } } } },
        tipAllocations: {
          include: { employee: { include: { user: { select: { name: true, role: true } } } } },
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    const aptIds = appointments.map((a) => a.id);

    const tipLedgerActive = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        OR: [
          { sourceType: 'TIP', sourceId: { in: aptIds } },
          {
            occurredAt: { gte: start, lte: end },
            OR: [
              { sourceType: 'TIP' },
              { type: 'TIP' },
              { description: { contains: 'انعام' } },
            ],
          },
        ],
      },
      orderBy: { id: 'asc' },
    });

    const tipLedgerDeleted = await prisma.transaction.findMany({
      where: {
        deletedAt: { not: null },
        sourceType: 'TIP',
        OR: [
          { sourceId: { in: aptIds } },
          { occurredAt: { gte: start, lte: end } },
        ],
      },
      orderBy: { id: 'asc' },
    });

    const bySourceId = new Map();
    for (const t of tipLedgerActive) {
      if (t.sourceType === 'TIP' && t.sourceId != null) {
        bySourceId.set(t.sourceId, t);
      }
    }

    const rows = appointments.map((a) => {
      const ledger = bySourceId.get(a.id) || null;
      return {
        appointmentId: a.id,
        paidAt: a.paidAt?.toISOString() || null,
        status: a.status,
        paymentMethod: a.paymentMethod,
        accountId: a.accountId,
        tipType: a.tipRecipientType,
        tipToman: toman(a.tipAmount),
        tipRial: a.tipAmount?.toString(),
        customer: a.customer?.user?.name || null,
        barber: a.employee?.user?.name || null,
        barberRole: a.employee?.user?.role || null,
        individualRecipient: a.tipRecipientEmployee?.user?.name || null,
        allocationCount: a.tipAllocations.length,
        allocationEmployeeIds: a.tipAllocations.map((x) => x.employeeId),
        hasLedgerTip: !!ledger,
        ledgerTxId: ledger?.id ?? null,
        ledgerType: ledger?.type ?? null,
        ledgerSourceType: ledger?.sourceType ?? null,
        ledgerDeletedAt: null,
        ledgerDescription: ledger?.description ?? null,
        ledgerAmountToman: ledger ? toman(ledger.amount) : null,
      };
    });

    const missing = rows.filter((r) => !r.hasLedgerTip);
    const present = rows.filter((r) => r.hasLedgerTip);

    // also find tip ledger rows in day whose appointment tip paidAt is NOT this day / missing apt tip
    const orphanLedger = tipLedgerActive.filter(
      (t) =>
        t.sourceType === 'TIP' &&
        t.sourceId != null &&
        !aptIds.includes(t.sourceId) &&
        t.occurredAt >= start &&
        t.occurredAt <= end,
    );

    const allocationTotal = appointments.reduce((s, a) => s + a.tipAllocations.length, 0);

    // scheduledAt-based tip appointments (possible alternate "appointment view")
    const byScheduled = await prisma.appointment.findMany({
      where: {
        deletedAt: null,
        tipAmount: { not: null, gt: 0n },
        scheduledAt: { gte: start, lte: end },
      },
      select: { id: true, paidAt: true, status: true, tipAmount: true, paymentMethod: true },
    });

    console.log(
      JSON.stringify(
        {
          day,
          rangeUtc: { start: start.toISOString(), end: end.toISOString() },
          appointmentTipsByPaidAt: appointments.length,
          tipAllocationRows: allocationTotal,
          ledgerTipActiveLinkedOrDay: tipLedgerActive.filter((t) => t.sourceType === 'TIP' || t.type === 'TIP')
            .length,
          ledgerTipActiveWithSourceTip: tipLedgerActive.filter((t) => t.sourceType === 'TIP').length,
          ledgerTipSoftDeleted: tipLedgerDeleted.length,
          presentCount: present.length,
          missingCount: missing.length,
          missingAppointmentIds: missing.map((m) => m.appointmentId),
          presentAppointmentIds: present.map((m) => m.appointmentId),
          byPaymentMethod: appointments.reduce((acc, a) => {
            const k = a.paymentMethod || 'NULL';
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {}),
          missingByPaymentMethod: missing.reduce((acc, a) => {
            const k = a.paymentMethod || 'NULL';
            acc[k] = (acc[k] || 0) + 1;
            return acc;
          }, {}),
          appointmentsWithTipByScheduledAt: byScheduled.length,
          scheduledOnlyIds: byScheduled
            .filter((a) => !aptIds.includes(a.id))
            .map((a) => ({
              id: a.id,
              status: a.status,
              paidAt: a.paidAt,
              tipToman: toman(a.tipAmount),
              paymentMethod: a.paymentMethod,
            })),
          orphanLedgerTipSourceIds: orphanLedger.map((t) => ({
            txId: t.id,
            sourceId: t.sourceId,
            amountToman: toman(t.amount),
            description: t.description,
          })),
          softDeletedTipTx: tipLedgerDeleted.map((t) => ({
            txId: t.id,
            sourceId: t.sourceId,
            amountToman: toman(t.amount),
            deletedAt: t.deletedAt,
            description: t.description,
          })),
          rows,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
})().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
