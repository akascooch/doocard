/**
 * Dry-run / apply backfill: link category-10 ledger txs (employeeId null) to employees.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-employee-ledger.ts
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-employee-ledger.ts --apply
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-employee-ledger.ts --apply --create-inactive
 */
import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  matchEmployeeByDescription,
  EmployeeNameRow,
} from '../src/accounting/ledger-backfill.match';
import { CANONICAL_EMPLOYEE_WITHDRAWAL_CATEGORY_ID } from '../src/common/constants/employee-commission.constants';

const prisma = new PrismaClient();

async function main() {
  const apply = process.argv.includes('--apply');
  const createInactive = process.argv.includes('--create-inactive');
  const dryRun = !apply;

  const employeesRaw = await prisma.employee.findMany({
    include: { user: { select: { name: true, role: true } } },
  });
  let employees: EmployeeNameRow[] = employeesRaw.map((e) => ({
    employeeId: e.id,
    name: e.user.name,
    isActive: e.isActive,
  }));

  const txs = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      categoryId: CANONICAL_EMPLOYEE_WITHDRAWAL_CATEGORY_ID,
      employeeId: null,
      type: 'EXPENSE',
    },
    orderBy: { id: 'asc' },
  });

  const report = {
    dryRun,
    scanned: txs.length,
    autoLinked: 0,
    candidatesOnly: 0,
    ambiguous: 0,
    unmatched: 0,
    inactiveCreated: 0,
    applied: 0,
    rows: [] as any[],
  };

  for (const tx of txs) {
    let match = matchEmployeeByDescription(tx.description, employees);
    let inactiveCreatedForRow = false;

    if (
      match.strategy === 'UNMATCHED' &&
      createInactive &&
      apply &&
      match.normalizedQuery
    ) {
      const phone = `inactive_${Date.now()}_${tx.id}`;
      const user = await prisma.user.create({
        data: {
          name: match.normalizedQuery,
          phone,
          password: '!',
          role: 'EMPLOYEE',
          employee: {
            create: {
              isActive: false,
              commissionRate: 40,
              specialty: 'LEGACY_BACKFILL',
            },
          },
        },
        include: { employee: true },
      });
      if (user.employee) {
        employees.push({
          employeeId: user.employee.id,
          name: user.name,
          isActive: false,
        });
        match = {
          strategy: 'EXACT_FULL_NAME',
          employeeId: user.employee.id,
          confidence: 'medium',
          candidateEmployeeIds: [user.employee.id],
          normalizedQuery: match.normalizedQuery,
          notes: 'Created inactive employee for unmatched name',
        };
        inactiveCreatedForRow = true;
        report.inactiveCreated += 1;
      }
    }

    const row = {
      transactionId: tx.id,
      description: tx.description,
      amount: tx.amount.toString(),
      match,
    };
    report.rows.push(row);

    if (match.strategy === 'EXACT_FULL_NAME' && match.employeeId) {
      report.autoLinked += 1;
      if (apply) {
        const prevMeta =
          tx.meta && typeof tx.meta === 'object' && !Array.isArray(tx.meta)
            ? (tx.meta as Record<string, unknown>)
            : {};
        await prisma.transaction.update({
          where: { id: tx.id },
          data: {
            employeeId: match.employeeId,
            meta: {
              ...prevMeta,
              backfillConfidence: match.confidence,
              backfillNotes: match.notes,
              linkedEmployeeNameMatchStrategy: match.strategy,
              migratedFromLegacyCategory:
                prevMeta.migratedFromLegacyCategory === true,
              sourceCategoryId: prevMeta.sourceCategoryId ?? null,
            } as Prisma.InputJsonValue,
          },
        });
        report.applied += 1;
      }
    } else if (match.strategy === 'UNIQUE_FIRST_TOKEN') {
      report.candidatesOnly += 1;
    } else if (match.strategy === 'AMBIGUOUS') {
      report.ambiguous += 1;
    } else {
      report.unmatched += 1;
    }

    if (inactiveCreatedForRow) {
      // already counted
    }
  }

  const outDir = path.join(__dirname, '..', 'backfill-reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    `employee-ledger-${dryRun ? 'dry-run' : 'apply'}-${Date.now()}.json`,
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        dryRun,
        scanned: report.scanned,
        autoLinked: report.autoLinked,
        candidatesOnly: report.candidatesOnly,
        ambiguous: report.ambiguous,
        unmatched: report.unmatched,
        inactiveCreated: report.inactiveCreated,
        applied: report.applied,
        reportPath: outPath,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
