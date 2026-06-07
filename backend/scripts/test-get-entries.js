const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testGetEntries() {
  try {
    console.log('🧪 Testing getEntries method...\n');

    // 1. بررسی وضعیت فعلی تراکنش‌ها
    console.log('📊 Current transactions:');
    const allTransactions = await prisma.transaction.findMany({
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

    console.log(`Found ${allTransactions.length} recent transactions:`);
    allTransactions.forEach((t, i) => {
      const sign = t.amount >= 0 ? '+' : '';
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: ${sign}${t.amount.toLocaleString('fa-IR')} - ${t.description || 'بدون توضیح'}`);
    });

    // 2. تست فیلتر EXPENSE
    console.log('\n💰 Testing EXPENSE filter:');
    const expenseTransactions = await prisma.transaction.findMany({
      where: { amount: { lt: 0 } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true
      }
    });

    console.log(`Found ${expenseTransactions.length} expense transactions:`);
    expenseTransactions.forEach((t, i) => {
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: ${t.amount.toLocaleString('fa-IR')} - ${t.description || 'بدون توضیح'}`);
    });

    // 3. تست فیلتر INCOME
    console.log('\n📈 Testing INCOME filter:');
    const incomeTransactions = await prisma.transaction.findMany({
      where: { amount: { gt: 0 } },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true
      }
    });

    console.log(`Found ${incomeTransactions.length} income transactions:`);
    incomeTransactions.forEach((t, i) => {
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: +${t.amount.toLocaleString('fa-IR')} - ${t.description || 'بدون توضیح'}`);
    });

    // 4. تست فیلتر category
    console.log('\n🏷️ Testing category filter (OTHER):');
    const otherTransactions = await prisma.transaction.findMany({
      where: { category: 'OTHER' },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true
      }
    });

    console.log(`Found ${otherTransactions.length} OTHER category transactions:`);
    otherTransactions.forEach((t, i) => {
      const sign = t.amount >= 0 ? '+' : '';
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: ${sign}${t.amount.toLocaleString('fa-IR')} - ${t.description || 'بدون توضیح'}`);
    });

    // 5. آمار کلی
    console.log('\n📊 Overall statistics:');
    const totalCount = await prisma.transaction.count();
    const expenseCount = await prisma.transaction.count({ where: { amount: { lt: 0 } } });
    const incomeCount = await prisma.transaction.count({ where: { amount: { gt: 0 } } });

    console.log(`Total transactions: ${totalCount}`);
    console.log(`Expense transactions: ${expenseCount}`);
    console.log(`Income transactions: ${incomeCount}`);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testGetEntries();
