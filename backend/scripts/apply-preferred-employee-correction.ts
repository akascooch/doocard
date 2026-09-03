/**
 * Apply preferred-employee correction from a dry-run JSON report.
 *
 * SAFETY:
 * - Default mode is DRY-RUN (no writes).
 * - Pass --apply to perform updates.
 * - Only rows with status === "suggested" are updated.
 * - tie_ambiguous / no_appointment_history / employee_inactive are skipped.
 * - Only updates customers that still have preferredEmployeeId IS NULL
 *   (idempotent; will not overwrite a preferred already set).
 * - Runs in a single Prisma interactive transaction.
 *
 * Usage (from Backend/):
 *   # dry-run preview
 *   npx ts-node --transpile-only scripts/apply-preferred-employee-correction.ts \
 *     --input=/tmp/preferred-employee-dry-run-20260725125247.json
 *
 *   # apply
 *   npx ts-node --transpile-only scripts/apply-preferred-employee-correction.ts \
 *     --input=/tmp/preferred-employee-dry-run-20260725125247.json --apply
 */
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

type DryRunRow = {
  customerId: number;
  customerName?: string;
  currentOwner?: string;
  suggestedOwner?: string | null;
  suggestedEmployeeId?: number | null;
  appointmentCount?: number;
  status?: string;
};

type DryRunReport = {
  dryRun?: boolean;
  appliedUpdates?: boolean;
  rows?: DryRunRow[];
};

function parseArgs(argv: string[]) {
  let input =
    process.env.INPUT_JSON ||
    '/tmp/preferred-employee-dry-run-20260725125247.json';
  let apply = false;
  for (const a of argv) {
    if (a === '--apply') apply = true;
    else if (a.startsWith('--input=')) input = a.slice('--input='.length);
  }
  return { input, apply };
}

async function main() {
  const { input, apply } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(input)) {
    throw new Error(`Input JSON not found: ${input}`);
  }

  const report = JSON.parse(
    fs.readFileSync(input, 'utf8'),
  ) as DryRunReport;
  const rows = Array.isArray(report.rows) ? report.rows : [];

  const suggested = rows.filter(
    (r) =>
      r.status === 'suggested' &&
      typeof r.customerId === 'number' &&
      typeof r.suggestedEmployeeId === 'number' &&
      r.suggestedEmployeeId > 0,
  );

  const skipped = {
    tie: rows.filter((r) => r.status === 'tie_ambiguous').length,
    noHistory: rows.filter((r) => r.status === 'no_appointment_history').length,
    inactive: rows.filter((r) => r.status === 'employee_inactive').length,
    other: rows.filter(
      (r) =>
        r.status !== 'suggested' &&
        r.status !== 'tie_ambiguous' &&
        r.status !== 'no_appointment_history' &&
        r.status !== 'employee_inactive',
    ).length,
  };

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY_RUN',
        input,
        totalRows: rows.length,
        suggestedEligible: suggested.length,
        skipped,
      },
      null,
      2,
    ),
  );

  if (!apply) {
    console.log(
      'DRY-RUN only. Re-run with --apply to update preferredEmployeeId for suggested rows.',
    );
    console.log('NO DATABASE UPDATES WERE PERFORMED.');
    return;
  }

  const prisma = new PrismaClient();
  const startedAt = new Date().toISOString();

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        let updated = 0;
        let alreadyAssigned = 0;
        let missingCustomer = 0;
        let missingEmployee = 0;
        const details: Array<{
          customerId: number;
          suggestedEmployeeId: number;
          outcome: string;
        }> = [];

        for (const row of suggested) {
          const customerId = row.customerId!;
          const employeeId = row.suggestedEmployeeId!;

          const emp = await tx.employee.findUnique({
            where: { id: employeeId },
            select: { id: true, isActive: true },
          });
          if (!emp?.isActive) {
            missingEmployee += 1;
            details.push({
              customerId,
              suggestedEmployeeId: employeeId,
              outcome: 'employee_missing_or_inactive',
            });
            continue;
          }

          const customer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { id: true, preferredEmployeeId: true },
          });
          if (!customer) {
            missingCustomer += 1;
            details.push({
              customerId,
              suggestedEmployeeId: employeeId,
              outcome: 'customer_missing',
            });
            continue;
          }
          if (customer.preferredEmployeeId != null) {
            alreadyAssigned += 1;
            details.push({
              customerId,
              suggestedEmployeeId: employeeId,
              outcome: 'already_assigned_skipped',
            });
            continue;
          }

          const res = await tx.customer.updateMany({
            where: { id: customerId, preferredEmployeeId: null },
            data: { preferredEmployeeId: employeeId },
          });
          if (res.count === 1) {
            updated += 1;
            details.push({
              customerId,
              suggestedEmployeeId: employeeId,
              outcome: 'updated',
            });
          } else {
            alreadyAssigned += 1;
            details.push({
              customerId,
              suggestedEmployeeId: employeeId,
              outcome: 'race_or_skipped',
            });
          }
        }

        return {
          updated,
          alreadyAssigned,
          missingCustomer,
          missingEmployee,
          details,
        };
      },
      { maxWait: 15_000, timeout: 120_000 },
    );

    const remainingNull = await prisma.customer.count({
      where: { preferredEmployeeId: null },
    });

    console.log(
      JSON.stringify(
        {
          mode: 'APPLY',
          startedAt,
          finishedAt: new Date().toISOString(),
          suggestedEligible: suggested.length,
          updated: result.updated,
          alreadyAssigned: result.alreadyAssigned,
          missingCustomer: result.missingCustomer,
          missingEmployee: result.missingEmployee,
          remainingNullPreferred: remainingNull,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
