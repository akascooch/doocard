/**
 * Fix: Set paidAt = scheduledAt for ARASH_IMPORT appointments so they appear in admin financial report.
 * Report filters by paidAt NOT NULL.
 */
import { PrismaClient } from '@prisma/client';

const IDEMPOTENCY_PREFIX = 'ARASH_IMPORT:';

async function main() {
  const prisma = new PrismaClient();
  const r = await prisma.$executeRaw`
    UPDATE appointments
    SET "paidAt" = "scheduledAt"
    WHERE notes LIKE ${'%' + IDEMPOTENCY_PREFIX + '%'} AND "deletedAt" IS NULL
  `;
  console.log('Updated paidAt = scheduledAt for', r, 'appointments');
  const count = await prisma.appointment.count({
    where: { notes: { contains: IDEMPOTENCY_PREFIX }, paidAt: { not: null } },
  });
  console.log('Verified: appointments with ARASH_IMPORT and paidAt set:', count);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
