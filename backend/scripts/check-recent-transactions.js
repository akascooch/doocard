const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkRecentTransactions() {
  try {
    console.log('🔍 Checking recent transactions...\n');

    // دریافت 10 تراکنش آخر
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true,
        status: true
      }
    });

    console.log(`Found ${recentTransactions.length} recent transactions:\n`);

    recentTransactions.forEach((t, i) => {
      const date = t.createdAt.toLocaleDateString('fa-IR');
      const time = t.createdAt.toLocaleTimeString('fa-IR');
      const sign = t.amount >= 0 ? '+' : '';
      
      console.log(`${i + 1}. ID: ${t.id}`);
      console.log(`   Amount: ${sign}${t.amount.toLocaleString('fa-IR')}`);
      console.log(`   Category: ${t.category}`);
      console.log(`   Description: ${t.description || 'بدون توضیح'}`);
      console.log(`   Date: ${date} ${time}`);
      console.log(`   Status: ${t.status}`);
      console.log('');
    });

    // بررسی تراکنش‌های هزینه
    console.log('💰 Checking expense transactions:');
    const expenseTransactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { amount: { lt: 0 } },
          { category: 'SALARY' },
          { category: 'UTILITY' },
          { category: 'RENT' },
          { category: 'SUPPLIES' },
          { category: 'OTHER' }
        ]
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true
      }
    });

    console.log(`Found ${expenseTransactions.length} expense transactions:\n`);

    expenseTransactions.forEach((t, i) => {
      const date = t.createdAt.toLocaleDateString('fa-IR');
      console.log(`${i + 1}. ${t.category}: ${t.amount.toLocaleString('fa-IR')} - ${t.description || 'بدون توضیح'} (${date})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentTransactions();
