const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Lord7know$@localhost:5433/MOVA'
    }
  }
});

async function backfillAccounting(options = {}) {
  const { dryRun = false } = options;
  
  console.log('🔄 Starting accounting data backfill...');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes)' : '✍️ LIVE (will modify database)'}\n`);

  // Get default account
  let defaultAccount = await prisma.bankAccount.findFirst({
    where: { isDefault: true, deletedAt: null }
  });

  if (!defaultAccount) {
    console.log('⚠️ No default account found, using first active account...');
    defaultAccount = await prisma.bankAccount.findFirst({
      where: { isActive: true, deletedAt: null }
    });
  }

  if (!defaultAccount) {
    console.log('❌ No bank accounts found! Please run seed script first.');
    return;
  }

  console.log(`✅ Using account: ${defaultAccount.name} (ID: ${defaultAccount.id})\n`);

  // Get categories
  const appointmentCategory = await prisma.transactionCategory.findFirst({
    where: { name: 'درآمد نوبت‌دهی', type: 'INCOME', deletedAt: null }
  });

  const tipCategory = await prisma.transactionCategory.findFirst({
    where: { name: 'انعام', type: 'INCOME', deletedAt: null }
  });

  const salaryCategory = await prisma.transactionCategory.findFirst({
    where: { name: 'حقوق و دستمزد', type: 'EXPENSE', deletedAt: null }
  });

  console.log('📁 Categories found:');
  console.log(`  - Appointments: ${appointmentCategory?.name || 'NOT FOUND'}`);
  console.log(`  - Tips: ${tipCategory?.name || 'NOT FOUND'}`);
  console.log(`  - Salaries: ${salaryCategory?.name || 'NOT FOUND'}\n`);

  let stats = {
    oldTransactionsMigrated: 0,
    tipsProcessed: 0,
    salariesProcessed: 0,
    totalAmount: BigInt(0),
    errors: 0
  };

  // Backfill from old Transaction records
  console.log('🔍 Checking old transactions...');
  const oldTransactions = await prisma.transaction.findMany({
    where: {
      sourceType: null,
      deletedAt: null
    },
    include: {
      appointment: true
    },
    take: 100
  });

  console.log(`Found ${oldTransactions.length} old transactions to migrate\n`);

  if (!dryRun && oldTransactions.length > 0) {
    for (const oldTx of oldTransactions) {
      try {
        await prisma.transaction.update({
          where: { id: oldTx.id },
          data: {
            sourceType: oldTx.appointment ? 'APPOINTMENT' : 'MANUAL',
            sourceId: oldTx.appointment?.id || null,
            accountId: defaultAccount.id,
            categoryId: appointmentCategory?.id || null,
            paymentMethod: oldTx.paymentMethod || 'CASH',
            occurredAt: oldTx.createdAt,
            meta: {
              migratedFrom: 'old_transaction',
              originalId: oldTx.id
            }
          }
        });

        stats.oldTransactionsMigrated++;
        console.log(`  ✅ Migrated transaction ${oldTx.id}`);
      } catch (error) {
        console.error(`  ❌ Error migrating transaction ${oldTx.id}:`, error.message);
        stats.errors++;
      }
    }
  }

  // Backfill Tips
  console.log('\n💰 Processing tips...');
  const tips = await prisma.tip.findMany({
    include: {
      appointment: true,
      employee: {
        include: { user: true }
      }
    }
  });

  console.log(`Found ${tips.length} tips`);

  if (!dryRun && tips.length > 0 && tipCategory) {
    for (const tip of tips) {
      try {
        const existing = await prisma.transaction.findFirst({
          where: {
            sourceType: 'TIP',
            sourceId: tip.id,
            deletedAt: null
          }
        });

        if (existing) {
          console.log(`  ⏭️ Tip ${tip.id} already has transaction`);
          continue;
        }

        await prisma.transaction.create({
          data: {
            type: 'INCOME',
            amount: BigInt(Math.floor(tip.amount * 10)),
            description: `انعام کارمند ${tip.employee?.user?.name || tip.employeeId}`,
            categoryId: tipCategory.id,
            accountId: defaultAccount.id,
            sourceType: 'TIP',
            sourceId: tip.id,
            paymentMethod: 'CASH',
            occurredAt: tip.createdAt,
            meta: {
              backfilled: true,
              appointmentId: tip.appointmentId,
              employeeId: tip.employeeId
            }
          }
        });

        stats.tipsProcessed++;
        stats.totalAmount += BigInt(Math.floor(tip.amount * 10));
        console.log(`  ✅ Created transaction for tip ${tip.id}`);
      } catch (error) {
        console.error(`  ❌ Error processing tip ${tip.id}:`, error.message);
        stats.errors++;
      }
    }
  }

  // Backfill Salaries
  console.log('\n💼 Processing salaries...');
  const paidSalaries = await prisma.salary.findMany({
    where: { status: 'PAID' },
    include: {
      employee: {
        include: { user: true }
      }
    }
  });

  console.log(`Found ${paidSalaries.length} paid salaries`);

  if (!dryRun && paidSalaries.length > 0 && salaryCategory) {
    for (const salary of paidSalaries) {
      try {
        const existing = await prisma.transaction.findFirst({
          where: {
            sourceType: 'SALARY',
            sourceId: salary.id,
            deletedAt: null
          }
        });

        if (existing) {
          console.log(`  ⏭️ Salary ${salary.id} already has transaction`);
          continue;
        }

        await prisma.transaction.create({
          data: {
            type: 'EXPENSE',
            amount: BigInt(Math.floor(salary.amount * 10)),
            description: `پرداخت حقوق ${salary.employee?.user?.name || salary.employeeId}`,
            categoryId: salaryCategory.id,
            accountId: defaultAccount.id,
            sourceType: 'SALARY',
            sourceId: salary.id,
            paymentMethod: 'CASH',
            occurredAt: salary.updatedAt,
            meta: {
              backfilled: true,
              employeeId: salary.employeeId,
              periodStart: salary.periodStart,
              periodEnd: salary.periodEnd
            }
          }
        });

        stats.salariesProcessed++;
        stats.totalAmount += BigInt(Math.floor(salary.amount * 10));
        console.log(`  ✅ Created transaction for salary ${salary.id}`);
      } catch (error) {
        console.error(`  ❌ Error processing salary ${salary.id}:`, error.message);
        stats.errors++;
      }
    }
  }

  // Recalculate account balances
  console.log('\n🔢 Recalculating account balances...');
  const accounts = await prisma.bankAccount.findMany({
    where: { deletedAt: null }
  });

  for (const account of accounts) {
    const aggregations = await prisma.transaction.groupBy({
      by: ['type'],
      where: {
        accountId: account.id,
        deletedAt: null
      },
      _sum: {
        amount: true
      }
    });

    let balance = BigInt(0);
    for (const agg of aggregations) {
      const sum = agg._sum.amount || BigInt(0);
      if (agg.type === 'INCOME') {
        balance += BigInt(sum);
      } else if (agg.type === 'EXPENSE') {
        balance -= BigInt(sum);
      }
    }

    if (!dryRun) {
      await prisma.bankAccount.update({
        where: { id: account.id },
        data: { balance }
      });
    }

    console.log(`  ✅ ${account.name}: ${balance} Rials`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Backfill Summary:');
  console.log('='.repeat(60));
  console.log(`Old Transactions Migrated: ${stats.oldTransactionsMigrated}`);
  console.log(`Tips Processed: ${stats.tipsProcessed}`);
  console.log(`Salaries Processed: ${stats.salariesProcessed}`);
  console.log(`Total Amount: ${stats.totalAmount} Rials`);
  console.log(`Errors: ${stats.errors}`);
  console.log('='.repeat(60));

  if (dryRun) {
    console.log('\n⚠️ This was a DRY RUN. No data was modified.');
    console.log('Run without --dry-run to apply changes.');
  } else {
    console.log('\n✅ Backfill completed successfully!');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

backfillAccounting({ dryRun })
  .catch((e) => {
    console.error('\n❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

