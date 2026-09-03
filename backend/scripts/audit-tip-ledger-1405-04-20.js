/**
 * READ-ONLY diagnostic: appointment tips vs ledger for 1405/04/20.
 * Usage (from backend cwd): node scripts/audit-tip-ledger-1405-04-20.js
 */
const { PrismaClient } = require('@prisma/client');
const jalaali = require('jalaali-js');

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;

function jalaliClosed(jstr) {
  const [jy, jm, jd] = jstr.split('/').map(Number);
  const g = jalaali.toGregorian(jy, jm, jd);
  const start = new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0) - TEHRAN_OFFSET_MS);
  const end = new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 23, 59, 59, 999) - TEHRAN_OFFSET_MS);
  return { start, end };
}

function toman(rial) {
  return (BigInt(rial) / 10n).toString();
}

(async () => {
  const prisma = new PrismaClient();
  const day = '1405/04/20';
  const { start, end } = jalaliClosed(day);
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
        tipAllocations: true,
      },
      orderBy: { paidAt: 'asc' },
    });

    const aptIds = appointments.map((a) => a.id);

    const tipTxActive = await prisma.transaction.findMany({
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

    const tipTxDeleted = await prisma.transaction.findMany({
      where: {
        deletedAt: { not: null },
        OR: [
          { sourceType: 'TIP', sourceId: { in: aptIds } },
          {
            occurredAt: { gte: start, lte: end },
            description: { contains: 'انعام' },
          },
        ],
      },
    });

    const dayTipTx = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        occurredAt: { gte: start, lte: end },
        OR: [{ sourceType: 'TIP' }, { type: 'TIP' }, { description: { contains: 'انعام' } }],
      },
    });

    const bySourceId = new Map();
    for (const t of tipTxActive) {
      if (t.sourceType === 'TIP' && t.sourceId != null) {
        bySourceId.set(t.sourceId, t);
      }
    }

    const rows = appointments.map((a) => {
      const ledger = bySourceId.get(a.id) || null;
      const dayMatch = dayTipTx.find(
        (t) => t.sourceType === 'TIP' && t.sourceId === a.id,
      );
      return {
        appointmentId: a.id,
        paidAt: a.paidAt?.toISOString() || null,
        status: a.status,
        paymentMethod: a.paymentMethod,
        tipType: a.tipRecipientType,
        tipToman: toman(a.tipAmount),
        tipAllocCount: a.tipAllocations.length,
        customer: a.customer?.user?.name || null,
        barber: a.employee?.user?.name || null,
        barberRole: a.employee?.user?.role || null,
        recipient: a.tipRecipientEmployee?.user?.name || null,
        hasLedgerBySourceId: !!ledger,
        ledgerTxId: ledger?.id ?? null,
        ledgerType: ledger?.type ?? null,
        ledgerSourceType: ledger?.sourceType ?? null,
        ledgerDeleted: false,
        ledgerAmountToman: ledger ? toman(ledger.amount) : null,
        ledgerDescription: ledger?.description ?? null,
        ledgerOccurredAt: ledger?.occurredAt?.toISOString() ?? null,
        hasDayOccurredMatch: !!dayMatch,
      };
    });

    const missing = rows.filter((r) => !r.hasLedgerBySourceId);
    const present = rows.filter((r) => r.hasLedgerBySourceId);

    // Also: appointments with tip on scheduledAt day but paidAt different
    const byScheduled = await prisma.appointment.findMany({
      where: {
        deletedAt: null,
        tipAmount: { not: null, gt: 0n },
        scheduledAt: { gte: start, lte: end },
        status: { in: ['SETTLED', 'PAID', 'COMPLETED'] },
      },
      select: {
        id: true,
        paidAt: true,
        scheduledAt: true,
        tipAmount: true,
        paymentMethod: true,
        status: true,
      },
    });

    const allocCount = appointments.reduce((s, a) => s + a.tipAllocations.length, 0);

    // Income appointment txs for same apt ids (for context)
    const apptIncome = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        sourceType: 'APPOINTMENT',
        sourceId: { in: aptIds },
      },
      select: { id: true, sourceId: true, amount: true, description: true },
    });

    console.log(
      JSON.stringify(
        {
          day,
          rangeUtc: { start: start.toISOString(), end: end.toISOString() },
          appointmentTipsByPaidAt: appointments.length,
          tipAllocationRows: allocCount,
          ledgerTipTxLinkedToThoseApts: present.length,
          missingLedgerCount: missing.length,
          dayTipLikeTransactions: dayTipTx.length,
          softDeletedTipLike: tipTxDeleted.length,
          appointmentsByScheduledAtWithTip: byScheduled.length,
          missing,
          presentSummary: present.map((p) => ({
            appointmentId: p.appointmentId,
            ledgerTxId: p.ledgerTxId,
            tipToman: p.tipToman,
            paymentMethod: p.paymentMethod,
          })),
          allAppointmentRows: rows,
          softDeleted: tipTxDeleted.map((t) => ({
            id: t.id,
            sourceId: t.sourceId,
            amountToman: toman(t.amount),
            deletedAt: t.deletedAt,
            description: t.description,
          })),
          apptIncomeMissingTipApts: missing.map((m) => ({
            appointmentId: m.appointmentId,
            hasAppointmentIncomeTx: apptIncome.some((x) => x.sourceId === m.appointmentId),
            paymentMethod: m.paymentMethod,
          })),
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
