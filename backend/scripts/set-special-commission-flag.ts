/**
 * LOCAL ONLY — bootstrap Employee.isSpecialCommission for known special barbers.
 *
 * Dry-run (default):
 *   npx ts-node -r tsconfig-paths/register scripts/set-special-commission-flag.ts
 *
 * Apply:
 *   npx ts-node -r tsconfig-paths/register scripts/set-special-commission-flag.ts --apply
 *
 * Does not hardcode names in runtime payroll logic — this is a one-shot bootstrap.
 * Requires the isSpecialCommission column to already exist (run prisma migrate deploy first).
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

/** Bootstrap identity list — used only by this script, never by payroll math. */
const BOOTSTRAP_SPECIAL_NAMES = ['آرش بهمن', 'اشکان اشتیش'] as const;

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();
  try {
    const matches = await prisma.employee.findMany({
      where: { user: { name: { in: [...BOOTSTRAP_SPECIAL_NAMES] } } },
      select: {
        id: true,
        isSpecialCommission: true,
        user: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'APPLY' : 'DRY_RUN',
          expectedNames: BOOTSTRAP_SPECIAL_NAMES,
          matches: matches.map((m) => ({
            employeeId: m.id,
            userId: m.user.id,
            name: m.user.name,
            isSpecialCommission: m.isSpecialCommission,
          })),
          missingNames: BOOTSTRAP_SPECIAL_NAMES.filter(
            (n) => !matches.some((m) => m.user.name === n),
          ),
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.log('\nDry-run only. Re-run with --apply to set isSpecialCommission=true.');
      return;
    }

    if (matches.length === 0) {
      console.error('No matching employees found — aborting apply.');
      process.exitCode = 2;
      return;
    }

    const result = await prisma.employee.updateMany({
      where: { id: { in: matches.map((m) => m.id) } },
      data: { isSpecialCommission: true },
    });
    console.log(`Updated ${result.count} employee row(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
