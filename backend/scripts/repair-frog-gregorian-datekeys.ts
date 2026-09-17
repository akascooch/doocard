/**
 * One-off, idempotent repair for Frog dateKey values stored as Gregorian YYYY-MM-DD.
 * Derives Jalali YYYY-MM-DD from scheduledAt in Asia/Tehran. Does not change
 * scheduledAt, title, user, completion, or reminder fields.
 *
 * Dry-run (default):
 *   npx ts-node -r tsconfig-paths/register scripts/repair-frog-gregorian-datekeys.ts
 *
 * Apply:
 *   npx ts-node -r tsconfig-paths/register scripts/repair-frog-gregorian-datekeys.ts --apply
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { gregorianYmdToJalaliDateKey } from '../src/admin-personal/frog-schedule.util';
import { getTehranGregorianYmd } from '../src/common/utils/tehran-business-day';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const APPLY = process.argv.includes('--apply');

function redactId(id: string): string {
  if (!id) return 'unknown';
  return `${id.slice(0, 8)}…`;
}

function isGregorianDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return Number(value.slice(0, 4)) >= 1700;
}

async function main() {
  const prisma = new PrismaClient();
  const candidates: Array<{ id: string; dateKey: string; next: string }> = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  try {
    const rows = await prisma.adminDailyFrog.findMany({
      select: { id: true, dateKey: true, scheduledAt: true },
      orderBy: { id: 'asc' },
    });

    for (const row of rows) {
      if (!isGregorianDateKey(row.dateKey)) continue;
      if (!row.scheduledAt || Number.isNaN(row.scheduledAt.getTime())) {
        skipped.push({ id: redactId(row.id), reason: 'invalid-scheduledAt' });
        continue;
      }
      const tehranYmd = getTehranGregorianYmd(row.scheduledAt);
      const next = gregorianYmdToJalaliDateKey(tehranYmd);
      if (!next) {
        skipped.push({ id: redactId(row.id), reason: 'conversion-failed' });
        continue;
      }
      if (next === row.dateKey) {
        skipped.push({ id: redactId(row.id), reason: 'already-canonical' });
        continue;
      }
      candidates.push({ id: redactId(row.id), dateKey: row.dateKey, next });
      if (APPLY) {
        await prisma.adminDailyFrog.update({
          where: { id: row.id },
          data: { dateKey: next },
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          mode: APPLY ? 'apply' : 'dry-run',
          scanned: rows.length,
          candidateCount: candidates.length,
          skippedCount: skipped.length,
          candidates,
          skipped,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'repair failed';
  console.error(message);
  process.exit(1);
});
