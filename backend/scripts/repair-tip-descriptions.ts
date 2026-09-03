/**
 * Repair TIP ledger descriptions to rich format:
 *   انعام نوبت #[ID] - مشتری: ... - آرایشگر: ... - نوع: TEAM|INDIVIDUAL
 * Also enrich TipSource.note for manual tips with recipient details.
 *
 * Dry-run by default. Never auto-runs on migrate/startup.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/repair-tip-descriptions.ts --start-jalali=1405/04/20
 *   npx ts-node -r tsconfig-paths/register scripts/repair-tip-descriptions.ts --start-jalali=1405/04/20 --apply
 *   npx ts-node -r tsconfig-paths/register scripts/repair-tip-descriptions.ts --start-jalali=1405/04/20 --end-jalali=1405/04/21 --json-out=./repair-tip-desc.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, TipSourceStatus } from '@prisma/client';
import {
  buildAppointmentTipDescription,
  buildManualTipNote,
} from '../src/common/utils/tip-ledger-description';
import {
  formatJalaliFromUtcInstant,
  jalaliRangeToTehranClosed,
  jalaliToTehranClosedRange,
  normalizeJalaliDigits,
} from '../src/common/utils/tehran-business-day';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

type TxReport = {
  kind: 'APPOINTMENT_TIP_TX';
  transactionId: number;
  appointmentId: number | null;
  occurredAt: string;
  occurredJalali: string;
  before: string | null;
  after: string | null;
  action: 'UPDATE' | 'SKIP_ALREADY' | 'SKIP_NO_APPOINTMENT' | 'SKIP_UNCHANGED';
};

type ManualReport = {
  kind: 'MANUAL_TIP_SOURCE';
  tipSourceId: number;
  effectiveJalali: string;
  before: string | null;
  after: string | null;
  action: 'UPDATE' | 'SKIP_ALREADY' | 'SKIP_UNCHANGED';
};

function parseArgs(argv: string[]) {
  const get = (name: string) => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const apply = argv.includes('--apply');
  return {
    apply,
    dryRun: !apply,
    startJalali: normalizeJalaliDigits(get('start-jalali') || '1405/04/20').replace(
      /-/g,
      '/',
    ),
    endJalali: get('end-jalali')
      ? normalizeJalaliDigits(get('end-jalali')!).replace(/-/g, '/')
      : undefined,
    jsonOut: get('json-out'),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startRange = jalaliToTehranClosedRange(args.startJalali);
  if (!startRange) {
    console.error('Invalid --start-jalali');
    process.exit(1);
  }
  const endInclusive = args.endJalali
    ? jalaliRangeToTehranClosed(args.startJalali, args.endJalali)?.endInclusive
    : null;
  if (args.endJalali && !endInclusive) {
    console.error('Invalid --end-jalali');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const txReports: TxReport[] = [];
  const manualReports: ManualReport[] = [];

  try {
    const tipTxs = await prisma.transaction.findMany({
      where: {
        sourceType: 'TIP',
        deletedAt: null,
        occurredAt: {
          gte: startRange.start,
          ...(endInclusive ? { lte: endInclusive } : {}),
        },
      },
      orderBy: { occurredAt: 'asc' },
    });

    console.log(
      `[repair-tip-descriptions] mode=${args.dryRun ? 'DRY-RUN' : 'APPLY'} start=${args.startJalali}` +
        (args.endJalali ? ` end=${args.endJalali}` : ' end=∞') +
        ` tipTxCount=${tipTxs.length}`,
    );

    const appointmentIds = [
      ...new Set(
        tipTxs
          .map((t) => t.sourceId)
          .filter((id): id is number => typeof id === 'number' && id > 0),
      ),
    ];
    const appointments = await prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      include: {
        customer: { include: { user: { select: { name: true } } } },
        employee: { include: { user: { select: { name: true } } } },
      },
    });
    const aptById = new Map(appointments.map((a) => [a.id, a]));

    for (const tx of tipTxs) {
      const occurredJalali = formatJalaliFromUtcInstant(tx.occurredAt);
      const aptId = tx.sourceId;
      if (!aptId) {
        txReports.push({
          kind: 'APPOINTMENT_TIP_TX',
          transactionId: tx.id,
          appointmentId: null,
          occurredAt: tx.occurredAt.toISOString(),
          occurredJalali,
          before: tx.description,
          after: null,
          action: 'SKIP_NO_APPOINTMENT',
        });
        continue;
      }
      const apt = aptById.get(aptId);
      if (!apt) {
        txReports.push({
          kind: 'APPOINTMENT_TIP_TX',
          transactionId: tx.id,
          appointmentId: aptId,
          occurredAt: tx.occurredAt.toISOString(),
          occurredJalali,
          before: tx.description,
          after: null,
          action: 'SKIP_NO_APPOINTMENT',
        });
        continue;
      }

      const after = buildAppointmentTipDescription({
        appointmentId: apt.id,
        customerName: apt.customer?.user?.name,
        barberName: apt.employee?.user?.name,
        tipRecipientType: apt.tipRecipientType,
      });
      const before = tx.description;
      if (before === after) {
        txReports.push({
          kind: 'APPOINTMENT_TIP_TX',
          transactionId: tx.id,
          appointmentId: apt.id,
          occurredAt: tx.occurredAt.toISOString(),
          occurredJalali,
          before,
          after,
          action: 'SKIP_ALREADY',
        });
        continue;
      }

      if (!args.dryRun) {
        await prisma.transaction.update({
          where: { id: tx.id },
          data: { description: after },
        });
      }
      txReports.push({
        kind: 'APPOINTMENT_TIP_TX',
        transactionId: tx.id,
        appointmentId: apt.id,
        occurredAt: tx.occurredAt.toISOString(),
        occurredJalali,
        before,
        after,
        action: 'UPDATE',
      });
    }

    const manuals = await prisma.tipSource.findMany({
      where: {
        status: TipSourceStatus.ACTIVE,
        effectiveBusinessAt: {
          gte: startRange.start,
          ...(endInclusive ? { lte: endInclusive } : {}),
        },
      },
      include: {
        recipientEmployee: { include: { user: { select: { name: true } } } },
        allocations: {
          include: {
            employee: { include: { user: { select: { name: true } } } },
          },
        },
      },
      orderBy: { effectiveBusinessAt: 'asc' },
    });

    console.log(`[repair-tip-descriptions] manualTipCount=${manuals.length}`);

    for (const src of manuals) {
      const after = buildManualTipNote({
        tipType: src.tipType,
        recipientName: src.recipientEmployee?.user?.name ?? null,
        teamMemberNames: src.allocations.map(
          (a) => a.employee?.user?.name ?? `کارمند #${a.employeeId}`,
        ),
        existingNote: src.note,
      });
      const before = src.note;
      if (before === after) {
        manualReports.push({
          kind: 'MANUAL_TIP_SOURCE',
          tipSourceId: src.id,
          effectiveJalali: formatJalaliFromUtcInstant(src.effectiveBusinessAt),
          before,
          after,
          action: before?.includes('انعام دستی - گیرنده:')
            ? 'SKIP_ALREADY'
            : 'SKIP_UNCHANGED',
        });
        continue;
      }

      if (!args.dryRun) {
        await prisma.tipSource.update({
          where: { id: src.id },
          data: { note: after },
        });
      }
      manualReports.push({
        kind: 'MANUAL_TIP_SOURCE',
        tipSourceId: src.id,
        effectiveJalali: formatJalaliFromUtcInstant(src.effectiveBusinessAt),
        before,
        after,
        action: 'UPDATE',
      });
    }

    const summary = {
      mode: args.dryRun ? 'DRY-RUN' : 'APPLY',
      startJalali: args.startJalali,
      endJalali: args.endJalali ?? null,
      tipTx: {
        total: txReports.length,
        update: txReports.filter((r) => r.action === 'UPDATE').length,
        skipAlready: txReports.filter((r) => r.action === 'SKIP_ALREADY').length,
        skipNoAppointment: txReports.filter((r) => r.action === 'SKIP_NO_APPOINTMENT')
          .length,
      },
      manual: {
        total: manualReports.length,
        update: manualReports.filter((r) => r.action === 'UPDATE').length,
        skipAlready: manualReports.filter((r) => r.action === 'SKIP_ALREADY').length,
        skipUnchanged: manualReports.filter((r) => r.action === 'SKIP_UNCHANGED')
          .length,
      },
    };

    console.log(JSON.stringify(summary, null, 2));
    for (const r of txReports.filter((x) => x.action === 'UPDATE').slice(0, 20)) {
      console.log(
        `TX #${r.transactionId} apt#${r.appointmentId}: "${r.before}" → "${r.after}"`,
      );
    }
    for (const r of manualReports.filter((x) => x.action === 'UPDATE')) {
      console.log(
        `MANUAL #${r.tipSourceId}: "${r.before}" → "${r.after}"`,
      );
    }

    if (args.jsonOut) {
      const outPath = path.isAbsolute(args.jsonOut)
        ? args.jsonOut
        : path.join(process.cwd(), args.jsonOut);
      fs.writeFileSync(
        outPath,
        JSON.stringify({ summary, tipTransactions: txReports, manuals: manualReports }, null, 2),
        'utf8',
      );
      console.log(`Wrote ${outPath}`);
    }

    if (args.dryRun) {
      console.log('Dry-run complete. Re-run with --apply to persist.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
