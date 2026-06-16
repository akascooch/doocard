/**
 * Scoped domain reset: appointments + INCOME/EXPENSE transactions only.
 * Preserves users, customers, employees, services, calendar_dates, etc.
 *
 * Usage:
 *   npx ts-node scripts/import-migration/reset-domain.ts --dry-run
 *   npx ts-node scripts/import-migration/reset-domain.ts --confirm
 */
import { PrismaClient } from '@prisma/client';

const TX_OPTS = { maxWait: 30_000, timeout: 300_000 };

interface CountSnapshot {
  tips: number;
  customer_debts_appointment: number;
  transactions_domain: number;
  appointment_services: number;
  appointments: number;
  sms_events_with_appt: number;
  notifications_appointment: number;
  day_closings: number;
  import_jobs: number;
  bank_accounts: { id: number; name: string; balance: string }[];
}

async function snapshot(prisma: PrismaClient): Promise<CountSnapshot> {
  const banks = await prisma.bankAccount.findMany({
    select: { id: true, name: true, balance: true },
    orderBy: { id: 'asc' },
  });

  return {
    tips: await prisma.tip.count(),
    customer_debts_appointment: await prisma.customerDebt.count({
      where: { sourceType: 'APPOINTMENT' },
    }),
    transactions_domain: await prisma.transaction.count({
      where: { type: { in: ['INCOME', 'EXPENSE', 'TIP', 'SERVICE'] } },
    }),
    appointment_services: await prisma.appointmentService.count(),
    appointments: await prisma.appointment.count(),
    sms_events_with_appt: await prisma.smsEvent.count({
      where: { appointmentId: { not: null } },
    }),
    notifications_appointment: await prisma.notification.count({
      where: {
        type: {
          in: [
            'APPOINTMENT_CREATED',
            'APPOINTMENT_CONFIRMED',
            'APPOINTMENT_SETTLED',
            'APPOINTMENT_CANCELLED',
          ],
        },
      },
    }),
    day_closings: await prisma.dayClosing.count(),
    import_jobs: await prisma.importJob.count(),
    bank_accounts: banks.map((b) => ({
      id: b.id,
      name: b.name,
      balance: b.balance.toString(),
    })),
  };
}

async function executeReset(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM "tips"`);
    // customer_debts has sourceType/sourceId (no appointmentId column)
    await tx.$executeRawUnsafe(
      `DELETE FROM "customer_debts" WHERE "sourceType" = 'APPOINTMENT'`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM "transactions" WHERE "type" IN ('INCOME', 'EXPENSE', 'TIP', 'SERVICE')`,
    );
    await tx.$executeRawUnsafe(`DELETE FROM "appointment_services"`);
    await tx.$executeRawUnsafe(`DELETE FROM "appointments"`);
    await tx.$executeRawUnsafe(
      `DELETE FROM "sms_events" WHERE "appointmentId" IS NOT NULL`,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM "notifications" WHERE "type"::text LIKE 'APPOINTMENT_%'`,
    );
    await tx.$executeRawUnsafe(`DELETE FROM "day_closings"`);
    await tx.$executeRawUnsafe(`DELETE FROM "import_jobs"`);
    await tx.$executeRawUnsafe(`UPDATE "bank_accounts" SET "balance" = 0`);
  }, TX_OPTS);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || !args.includes('--confirm');
  const confirm = args.includes('--confirm');

  if (!dryRun && !confirm) {
    console.error('Pass --dry-run or --confirm');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    console.log('=== Domain Reset (appointments + transactions) ===');
    console.log('Mode:', dryRun ? 'DRY-RUN' : 'CONFIRM');

    const before = await snapshot(prisma);
    console.log('\nBefore:');
    console.log(JSON.stringify(before, null, 2));

    if (dryRun) {
      console.log('\nNo data deleted. Re-run with --confirm to execute.');
      return;
    }

    await executeReset(prisma);

    const after = await snapshot(prisma);
    console.log('\nAfter:');
    console.log(JSON.stringify(after, null, 2));
    console.log('\n✅ Domain reset completed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
