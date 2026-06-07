const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBothTables() {
  try {
    console.log('🧪 Testing both tables (transactions + financialEntry)...\n');

    // 1. بررسی جدول transactions
    console.log('📊 Transactions table:');
    const transactions = await prisma.transaction.findMany({
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`Found ${transactions.length} transactions`);
    transactions.forEach((t, i) => {
      console.log(`${i + 1}. ${t.category}: ${t.amount.toLocaleString('fa-IR')} - ${t.description || 'بدون توضیح'}`);
    });

    // 2. بررسی جدول financialEntry
    console.log('\n📋 FinancialEntry table:');
    const financialEntries = await prisma.financialEntry.findMany({
      select: {
        id: true,
        amount: true,
        type: true,
        description: true,
        date: true
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    console.log(`Found ${financialEntries.length} financial entries`);
    financialEntries.forEach((f, i) => {
      console.log(`${i + 1}. ${f.type}: ${f.amount.toLocaleString('fa-IR')} - ${f.description || 'بدون توضیح'}`);
    });

    // 3. محاسبه آمار از هر دو جدول
    console.log('\n💰 Calculating stats from both tables:');
    
    // از جدول transactions
    const transactionIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true }
    });

    const transactionExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true }
    });

    // از جدول financialEntry
    const financialEntryIncome = await prisma.financialEntry.aggregate({
      where: { type: 'INCOME' },
      _sum: { amount: true }
    });

    const financialEntryExpense = await prisma.financialEntry.aggregate({
      where: { type: 'EXPENSE' },
      _sum: { amount: true }
    });

    console.log('📈 Income:');
    console.log(`  - Transactions: ${(transactionIncome._sum.amount || 0).toLocaleString('fa-IR')}`);
    console.log(`  - FinancialEntry: ${(financialEntryIncome._sum.amount || 0).toLocaleString('fa-IR')}`);
    console.log(`  - Total: ${((transactionIncome._sum.amount || 0) + (financialEntryIncome._sum.amount || 0)).toLocaleString('fa-IR')}`);

    console.log('\n📉 Expenses:');
    console.log(`  - Transactions: ${Math.abs(transactionExpense._sum.amount || 0).toLocaleString('fa-IR')}`);
    console.log(`  - FinancialEntry: ${(financialEntryExpense._sum.amount || 0).toLocaleString('fa-IR')}`);
    console.log(`  - Total: ${(Math.abs(transactionExpense._sum.amount || 0) + (financialEntryExpense._sum.amount || 0)).toLocaleString('fa-IR')}`);

    const totalIncome = (transactionIncome._sum.amount || 0) + (financialEntryIncome._sum.amount || 0);
    const totalExpense = Math.abs(transactionExpense._sum.amount || 0) + (financialEntryExpense._sum.amount || 0);
    const balance = totalIncome - totalExpense;

    console.log(`\n🏦 Balance: ${balance.toLocaleString('fa-IR')}`);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBothTables();
