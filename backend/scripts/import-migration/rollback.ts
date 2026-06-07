/**

 * Rollback an Excel migration batch by batchId.

 *

 * Usage:

 *   npx ts-node scripts/import-migration/rollback.ts --batch-id=excel-migration-123 --dry-run

 *   npx ts-node scripts/import-migration/rollback.ts --batch-id=excel-migration-123 --confirm

 */

import { PrismaClient } from '@prisma/client';



const BATCH_SIZE = 100;

const TX_OPTS = { maxWait: 30_000, timeout: 120_000 };



function parseArgs(): { batchId: string; dryRun: boolean; confirm: boolean } {

  const args = process.argv.slice(2);

  const batchArg = args.find((a) => a.startsWith('--batch-id='));

  const batchId = batchArg?.split('=')[1];

  if (!batchId) {

    throw new Error('--batch-id is required');

  }

  return {

    batchId,

    dryRun: args.includes('--dry-run') || !args.includes('--confirm'),

    confirm: args.includes('--confirm'),

  };

}



async function main() {

  const { batchId, dryRun, confirm } = parseArgs();

  const prisma = new PrismaClient();



  try {

    const job = await prisma.importJob.findUnique({ where: { batchId } });

    if (!job) {

      console.warn(`ImportJob not found for batchId=${batchId} (continuing with data cleanup)`);

    }



    const expenseTx = await prisma.transaction.findMany({

      where: {

        deletedAt: null,

        type: 'EXPENSE',

        meta: { path: ['batchId'], equals: batchId },

      },

      select: { id: true, amount: true, accountId: true },

    });



    const incomeTx = await prisma.transaction.findMany({

      where: {

        deletedAt: null,

        type: 'INCOME',

        meta: { path: ['batchId'], equals: batchId },

      },

      select: { id: true, amount: true, accountId: true },

    });



    const appointments = await prisma.appointment.findMany({

      where: {

        deletedAt: null,

        notes: { contains: `batch=${batchId}` },

      },

      select: { id: true },

    });



    console.log('--- Rollback preview ---');

    console.log('batchId:', batchId);

    console.log('expense transactions:', expenseTx.length);

    console.log('income transactions:', incomeTx.length);

    console.log('appointments:', appointments.length);



    if (dryRun || !confirm) {

      console.log('\nDry-run only. Re-run with --confirm to delete.');

      return;

    }



    for (let i = 0; i < expenseTx.length; i += BATCH_SIZE) {

      const batch = expenseTx.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {

        for (const t of batch) {

          if (t.accountId) {

            await tx.bankAccount.update({

              where: { id: t.accountId },

              data: { balance: { increment: t.amount } },

            });

          }

          await tx.transaction.update({

            where: { id: t.id },

            data: { deletedAt: new Date() },

          });

        }

      }, TX_OPTS);

    }



    for (let i = 0; i < incomeTx.length; i += BATCH_SIZE) {

      const batch = incomeTx.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {

        for (const t of batch) {

          if (t.accountId) {

            await tx.bankAccount.update({

              where: { id: t.accountId },

              data: { balance: { decrement: t.amount } },

            });

          }

          await tx.transaction.update({

            where: { id: t.id },

            data: { deletedAt: new Date() },

          });

        }

      }, TX_OPTS);

    }



    for (let i = 0; i < appointments.length; i += BATCH_SIZE) {

      const batch = appointments.slice(i, i + BATCH_SIZE);

      await prisma.$transaction(async (tx) => {

        for (const appt of batch) {

          await tx.appointmentService.deleteMany({ where: { appointmentId: appt.id } });

          await tx.appointment.update({

            where: { id: appt.id },

            data: { deletedAt: new Date() },

          });

        }

      }, TX_OPTS);

    }



    if (job) {

      await prisma.importJob.update({

        where: { batchId },

        data: { status: 'CANCELLED', finishedAt: new Date() },

      });

    }



    console.log('\n✅ Rollback completed (soft-delete appointments/transactions, balance reversed).');

  } finally {

    await prisma.$disconnect();

  }

}



main().catch((e) => {

  console.error(e);

  process.exit(1);

});


