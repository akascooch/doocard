const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testExpenses() {
  try {
    console.log('🧪 Testing expense calculations...\n');

    // 1. بررسی تمام تراکنش‌ها
    console.log('📊 All transactions:');
    const allTransactions = await prisma.transaction.findMany({
      select: {
        id: true,
        amount: true,
        category: true,
        createdAt: true,
        description: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Total transactions: ${allTransactions.length}`);

    // 2. گروه‌بندی بر اساس category
    const categoryStats = {};
    allTransactions.forEach(t => {
      if (!categoryStats[t.category]) {
        categoryStats[t.category] = { count: 0, total: 0 };
      }
      categoryStats[t.category].count++;
      categoryStats[t.category].total += t.amount;
    });

    console.log('\n📋 Transactions by category:');
    Object.keys(categoryStats).forEach(category => {
      const stats = categoryStats[category];
      console.log(`${category}: ${stats.count} transactions, Total: ${stats.total.toLocaleString('fa-IR')}`);
    });

    // 3. محاسبه هزینه‌ها با منطق جدید
    console.log('\n💰 Calculating expenses with new logic:');
    
    const expenseTransactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { amount: { lt: 0 } }, // تراکنش‌های منفی
          { category: 'SALARY' }, // حقوق
          { category: 'UTILITY' }, // قبوض
          { category: 'RENT' }, // اجاره
          { category: 'SUPPLIES' }, // لوازم
          { category: 'OTHER' } // سایر هزینه‌ها
        ]
      },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true
      }
    });

    console.log(`Expense transactions found: ${expenseTransactions.length}`);
    
    let totalExpense = 0;
    expenseTransactions.forEach(t => {
      totalExpense += Math.abs(t.amount);
      console.log(`- ${t.category}: ${t.amount.toLocaleString('fa-IR')} (${t.description || 'بدون توضیح'})`);
    });

    console.log(`\nTotal expenses: ${totalExpense.toLocaleString('fa-IR')}`);

    // 4. محاسبه درآمد
    console.log('\n💵 Calculating income:');
    
    const incomeTransactions = await prisma.transaction.findMany({
      where: {
        amount: { gt: 0 },
        NOT: {
          OR: [
            { category: 'SALARY' },
            { category: 'UTILITY' },
            { category: 'RENT' },
            { category: 'SUPPLIES' },
            { category: 'OTHER' }
          ]
        }
      },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true
      }
    });

    console.log(`Income transactions found: ${incomeTransactions.length}`);
    
    let totalIncome = 0;
    incomeTransactions.forEach(t => {
      totalIncome += t.amount;
      console.log(`- ${t.category}: ${t.amount.toLocaleString('fa-IR')} (${t.description || 'بدون توضیح'})`);
    });

    console.log(`\nTotal income: ${totalIncome.toLocaleString('fa-IR')}`);

    // 5. محاسبه موجودی
    const balance = totalIncome - totalExpense;
    console.log(`\n🏦 Balance: ${balance.toLocaleString('fa-IR')}`);

    // 6. بررسی تراکنش‌های خاص
    console.log('\n🔍 Special transaction analysis:');
    
    const salaryTransactions = await prisma.transaction.findMany({
      where: { category: 'SALARY' }
    });
    
    const utilityTransactions = await prisma.transaction.findMany({
      where: { category: 'UTILITY' }
    });
    
    const otherTransactions = await prisma.transaction.findMany({
      where: { category: 'OTHER' }
    });

    console.log(`Salary transactions: ${salaryTransactions.length}`);
    console.log(`Utility transactions: ${utilityTransactions.length}`);
    console.log(`Other transactions: ${otherTransactions.length}`);

    console.log('\n✅ Expense test completed successfully!');

  } catch (error) {
    console.error('❌ Error in expense test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testExpenses();
