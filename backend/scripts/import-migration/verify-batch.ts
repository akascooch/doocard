import { PrismaClient } from '@prisma/client';

const batchId = process.argv[2];
if (!batchId) {
  console.error('Usage: npx ts-node scripts/import-migration/verify-batch.ts <batchId>');
  process.exit(1);
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const job = await prisma.importJob.findUnique({ where: { batchId } });
    const expenseTx = await prisma.transaction.count({
      where: { deletedAt: null, type: 'EXPENSE', meta: { path: ['batchId'], equals: batchId } },
    });
    const incomeTx = await prisma.transaction.count({
      where: { deletedAt: null, type: 'INCOME', meta: { path: ['batchId'], equals: batchId } },
    });
    const appts = await prisma.appointment.count({
      where: { deletedAt: null, notes: { contains: `batch=${batchId}` } },
    });
    const apptIds = await prisma.appointment.findMany({
      where: { deletedAt: null, notes: { contains: `batch=${batchId}` } },
      select: { id: true },
    });
    const apptSvc = await prisma.appointmentService.count({
      where: { appointmentId: { in: apptIds.map((a) => a.id) } },
    });
    const expenseSum = await prisma.transaction.aggregate({
      where: { deletedAt: null, type: 'EXPENSE', meta: { path: ['batchId'], equals: batchId } },
      _sum: { amount: true },
    });
    const incomeSum = await prisma.transaction.aggregate({
      where: { deletedAt: null, type: 'INCOME', meta: { path: ['batchId'], equals: batchId } },
      _sum: { amount: true },
    });
    const apptSum = await prisma.appointment.aggregate({
      where: { deletedAt: null, notes: { contains: `batch=${batchId}` } },
      _sum: { amount: true },
    });
    const softDeletedAppts = await prisma.appointment.count({
      where: { deletedAt: { not: null }, notes: { contains: `batch=${batchId}` } },
    });
    const bank = await prisma.bankAccount.findFirst({ where: { id: 1 }, select: { balance: true } });

    console.log(
      JSON.stringify(
        {
          batchId,
          importJob: job ? { status: job.status, created: job.created, failed: job.failed } : null,
          active: {
            expenseTransactions: expenseTx,
            incomeTransactions: incomeTx,
            appointments: appts,
            appointmentServices: apptSvc,
          },
          softDeletedAppointments: softDeletedAppts,
          sumsRial: {
            expenses: expenseSum._sum.amount?.toString() ?? '0',
            income: incomeSum._sum.amount?.toString() ?? '0',
            appointmentAmounts: apptSum._sum.amount?.toString() ?? '0',
          },
          bankAccount1Balance: bank?.balance?.toString() ?? null,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
