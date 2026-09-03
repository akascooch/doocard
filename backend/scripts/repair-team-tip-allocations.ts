/**
 * Repair legacy TEAM tip allocations (50% barber/non-SERVICE + 50% SERVICE pool)
 * to 100% equal split among original tipTeamMemberIds snapshot (SERVICE only).
 *
 * Dry-run by default. Never auto-runs on migrate/startup.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/repair-team-tip-allocations.ts --start-jalali=1405/04/20
 *   npx ts-node -r tsconfig-paths/register scripts/repair-team-tip-allocations.ts --start-jalali=1405/04/20 --apply
 *   npx ts-node -r tsconfig-paths/register scripts/repair-team-tip-allocations.ts --start-jalali=1405/04/20 --end-jalali=1405/04/21 --json-out=./repair-report.json
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, UserRole } from '@prisma/client';
import { computeTeamTipAllocations } from '../src/accounting/ledger-backfill.match';
import {
  formatJalaliFromUtcInstant,
  jalaliRangeToTehranClosed,
  jalaliToTehranClosedRange,
  normalizeJalaliDigits,
} from '../src/common/utils/tehran-business-day';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

type Category =
  | 'SAFE_TO_REPAIR'
  | 'ALREADY_CORRECT'
  | 'SKIPPED_SETTLED'
  | 'SKIPPED_AMBIGUOUS'
  | 'FAILED_INVARIANT';

type SourceReport = {
  category: Category;
  appointmentId: number;
  tipAmountRial: string;
  tipAmountToman: string;
  effectiveJalali: string | null;
  paidAt: string | null;
  snapshotMemberIds: number[];
  eligibleServiceIds: number[];
  beforeAllocations: { id: number; employeeId: number; role: string | null; amountRial: string; paidInSettlementId: number | null }[];
  afterAllocations?: { employeeId: number; amountRial: string }[];
  reason?: string;
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
    startJalali: normalizeJalaliDigits(get('start-jalali') || '1405/04/20').replace(/-/g, '/'),
    endJalali: get('end-jalali')
      ? normalizeJalaliDigits(get('end-jalali')!).replace(/-/g, '/')
      : undefined,
    appointmentId: get('appointment-id')
      ? parseInt(get('appointment-id')!, 10)
      : undefined,
    jsonOut: get('json-out'),
  };
}

function parseSnapshot(raw: unknown): number[] | null {
  if (raw == null) return null;
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr)) return null;
  const ids = [
    ...new Set(arr.map(Number).filter((n) => Number.isInteger(n) && n > 0)),
  ].sort((a, b) => a - b);
  return ids;
}

function sum(rows: { amountRial: bigint }[]): bigint {
  return rows.reduce((s, r) => s + r.amountRial, 0n);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const startRange = jalaliToTehranClosedRange(args.startJalali);
  if (!startRange) {
    console.error('Invalid --start-jalali');
    process.exit(2);
  }
  let endInclusive = new Date();
  if (args.endJalali) {
    const endRange = jalaliToTehranClosedRange(args.endJalali);
    if (!endRange) {
      console.error('Invalid --end-jalali');
      process.exit(2);
    }
    endInclusive = endRange.endInclusive;
  }
  // Scope never includes before start day
  const range = jalaliRangeToTehranClosed(
    args.startJalali,
    args.endJalali || formatJalaliFromUtcInstant(endInclusive),
  );
  if (!range) {
    console.error('Invalid date range');
    process.exit(2);
  }

  // Hard gate: start must be >= 1405/04/20
  const gate = jalaliToTehranClosedRange('1405/04/20');
  if (!gate || range.start.getTime() < gate.start.getTime()) {
    console.error('Refusing repair before 1405/04/20');
    process.exit(2);
  }

  const prisma = new PrismaClient();
  const reports: SourceReport[] = [];
  let failedInvariant = 0;

  try {
    const appointments = await prisma.appointment.findMany({
      where: {
        deletedAt: null,
        tipRecipientType: 'TEAM',
        tipAmount: { gt: 0n },
        paidAt: { gte: range.start, lte: range.endInclusive },
        status: { in: ['SETTLED', 'PAID', 'COMPLETED'] },
        ...(args.appointmentId ? { id: args.appointmentId } : {}),
      },
      include: {
        tipAllocations: {
          include: {
            employee: { include: { user: { select: { role: true, name: true } } } },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    for (const apt of appointments) {
      const tipAmount = apt.tipAmount ?? 0n;
      const paidAt = apt.paidAt;
      const effectiveJalali = paidAt ? formatJalaliFromUtcInstant(paidAt) : null;
      const before = apt.tipAllocations.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        role: a.employee?.user?.role ?? null,
        amountRial: a.amountRial.toString(),
        paidInSettlementId: a.paidInSettlementId,
      }));

      const baseMeta = {
        appointmentId: apt.id,
        tipAmountRial: tipAmount.toString(),
        tipAmountToman: (tipAmount / 10n).toString(),
        effectiveJalali,
        paidAt: paidAt?.toISOString() ?? null,
        beforeAllocations: before,
      };

      if (before.some((b) => b.paidInSettlementId != null)) {
        reports.push({
          category: 'SKIPPED_SETTLED',
          ...baseMeta,
          snapshotMemberIds: parseSnapshot(apt.tipTeamMemberIds) || [],
          eligibleServiceIds: [],
          reason: 'At least one allocation already paid/settled',
        });
        continue;
      }

      const snapshot = parseSnapshot(apt.tipTeamMemberIds);
      if (!snapshot || snapshot.length === 0) {
        reports.push({
          category: 'SKIPPED_AMBIGUOUS',
          ...baseMeta,
          snapshotMemberIds: [],
          eligibleServiceIds: [],
          reason: 'Missing or empty tipTeamMemberIds snapshot',
        });
        continue;
      }

      const employees = await prisma.employee.findMany({
        where: { id: { in: snapshot } },
        include: { user: { select: { role: true } } },
      });
      const roleById = new Map(employees.map((e) => [e.id, e.user.role]));
      const missing = snapshot.filter((id) => !roleById.has(id));
      if (missing.length > 0) {
        reports.push({
          category: 'SKIPPED_AMBIGUOUS',
          ...baseMeta,
          snapshotMemberIds: snapshot,
          eligibleServiceIds: [],
          reason: `Snapshot employee ids not found: ${missing.join(',')}`,
        });
        continue;
      }

      const eligibleServiceIds = snapshot.filter(
        (id) => roleById.get(id) === UserRole.SERVICE,
      );
      if (eligibleServiceIds.length === 0) {
        reports.push({
          category: 'FAILED_INVARIANT',
          ...baseMeta,
          snapshotMemberIds: snapshot,
          eligibleServiceIds: [],
          reason: 'No SERVICE recipients in original snapshot',
        });
        failedInvariant += 1;
        continue;
      }

      let expected;
      try {
        expected = computeTeamTipAllocations(tipAmount, null, eligibleServiceIds);
      } catch (e) {
        reports.push({
          category: 'FAILED_INVARIANT',
          ...baseMeta,
          snapshotMemberIds: snapshot,
          eligibleServiceIds,
          reason: `computeTeamTipAllocations failed: ${(e as Error).message}`,
        });
        failedInvariant += 1;
        continue;
      }

      const expectedSum = sum(expected);
      if (expectedSum !== tipAmount) {
        reports.push({
          category: 'FAILED_INVARIANT',
          ...baseMeta,
          snapshotMemberIds: snapshot,
          eligibleServiceIds,
          reason: `Expected sum ${expectedSum} != tip ${tipAmount}`,
        });
        failedInvariant += 1;
        continue;
      }

      const currentByEmp = new Map(
        apt.tipAllocations.map((a) => [a.employeeId, a.amountRial]),
      );
      const expectedByEmp = new Map(expected.map((e) => [e.employeeId, e.amountRial]));
      const nonServiceCurrent = apt.tipAllocations.filter(
        (a) => a.employee?.user?.role !== UserRole.SERVICE,
      );
      const currentSum = sum(apt.tipAllocations);
      const alreadyCorrect =
        nonServiceCurrent.length === 0 &&
        currentSum === tipAmount &&
        expectedByEmp.size === currentByEmp.size &&
        [...expectedByEmp.entries()].every(([id, amt]) => {
          const employeeId = Number(id);
          return currentByEmp.get(employeeId) === amt;
        });

      if (alreadyCorrect) {
        reports.push({
          category: 'ALREADY_CORRECT',
          ...baseMeta,
          snapshotMemberIds: snapshot,
          eligibleServiceIds,
          afterAllocations: expected.map((e) => ({
            employeeId: e.employeeId,
            amountRial: e.amountRial.toString(),
          })),
        });
        continue;
      }

      // Detect ambiguous if current sum != tip and also != tip/2 (legacy pattern) — still repairable if snapshot reliable
      reports.push({
        category: 'SAFE_TO_REPAIR',
        ...baseMeta,
        snapshotMemberIds: snapshot,
        eligibleServiceIds,
        afterAllocations: expected.map((e) => ({
          employeeId: e.employeeId,
          amountRial: e.amountRial.toString(),
        })),
        reason:
          nonServiceCurrent.length > 0
            ? 'Legacy non-SERVICE allocation present'
            : 'SERVICE pool not equal to 100% source',
      });
    }

    const safe = reports.filter((r) => r.category === 'SAFE_TO_REPAIR');
    const summary = {
      mode: args.dryRun ? 'DRY_RUN' : 'APPLY',
      startJalali: args.startJalali,
      endJalali: args.endJalali || null,
      scanned: reports.length,
      SAFE_TO_REPAIR: safe.length,
      ALREADY_CORRECT: reports.filter((r) => r.category === 'ALREADY_CORRECT').length,
      SKIPPED_SETTLED: reports.filter((r) => r.category === 'SKIPPED_SETTLED').length,
      SKIPPED_AMBIGUOUS: reports.filter((r) => r.category === 'SKIPPED_AMBIGUOUS')
        .length,
      FAILED_INVARIANT: reports.filter((r) => r.category === 'FAILED_INVARIANT')
        .length,
      sourceTotalRial: reports
        .reduce((s, r) => s + BigInt(r.tipAmountRial), 0n)
        .toString(),
      writes: 0,
    };

    if (args.apply) {
      if (failedInvariant > 0) {
        console.error('ABORT: FAILED_INVARIANT present — refusing --apply');
        process.exitCode = 3;
      } else {
        for (const item of safe) {
          await prisma.$transaction(async (tx) => {
            const fresh = await tx.appointmentTipAllocation.findMany({
              where: { appointmentId: item.appointmentId },
            });
            if (fresh.some((a) => a.paidInSettlementId != null)) {
              throw new Error(`Settled during apply: appointment ${item.appointmentId}`);
            }
            await tx.appointmentTipAllocation.deleteMany({
              where: { appointmentId: item.appointmentId },
            });
            await tx.appointmentTipAllocation.createMany({
              data: (item.afterAllocations || []).map((a) => ({
                appointmentId: item.appointmentId,
                employeeId: a.employeeId,
                amountRial: BigInt(a.amountRial),
              })),
            });
            const after = await tx.appointmentTipAllocation.findMany({
              where: { appointmentId: item.appointmentId },
            });
            const afterSum = after.reduce((s, a) => s + a.amountRial, 0n);
            if (afterSum !== BigInt(item.tipAmountRial)) {
              throw new Error(
                `Post-repair sum mismatch appointment ${item.appointmentId}`,
              );
            }
          });
          summary.writes += 1;
        }
      }
    }

    const out = { summary, reports };
    console.log(JSON.stringify(summary, null, 2));
    if (args.jsonOut) {
      fs.writeFileSync(args.jsonOut, JSON.stringify(out, null, 2), 'utf8');
      console.log(`Wrote ${args.jsonOut}`);
    } else {
      // Print compact per-source categories
      for (const r of reports) {
        console.log(
          `${r.category}\tapt=${r.appointmentId}\t${r.tipAmountToman} Toman\t${r.effectiveJalali}\t${r.reason || ''}`,
        );
      }
    }

    if (failedInvariant > 0) process.exitCode = process.exitCode || 3;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
