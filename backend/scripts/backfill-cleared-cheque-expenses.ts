/**
 * Dry-run / apply: create EXPENSE ledger rows for historical CLEARED cheques
 * that have no transactionId. Never double-counts STAFF_SALARY payroll.
 *
 * PrismaClient only — do NOT boot Nest AppModule (that would register crons/SMS).
 *
 * Usage:
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/backfill-cleared-cheque-expenses.ts
 *   npx ts-node -r dotenv/config -r tsconfig-paths/register scripts/backfill-cleared-cheque-expenses.ts --apply
 *
 * Do not run --apply on production without an explicit owner approval and a DB dump.
 */
import { PrismaClient } from '@prisma/client';
import { AccountingService } from '../src/accounting/accounting.service';

async function main() {
  const apply = process.argv.includes('--apply') && !process.argv.includes('--dry-run');
  const prisma = new PrismaClient();
  try {
    const accounting = new AccountingService(
      prisma as never,
      { create: async () => ({}) } as never,
      { sendToRole: () => undefined, sendToUser: () => undefined } as never,
      { sendToRole: async () => ({ sent: 0, failed: 0 }), sendToUser: async () => ({ sent: 0, failed: 0 }) } as never,
    );
    const result = await accounting.backfillClearedChequeExpenses({ dryRun: !apply });
    console.log(JSON.stringify(result, null, 2));
    if (!apply) {
      console.log('Dry-run only. Pass --apply to write ledger rows.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
