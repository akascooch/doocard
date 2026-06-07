const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testRecentTransactions() {
  try {
    console.log('🧪 Testing getRecentTransactions method...\n');

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

    // 4. آمار کلی
    console.log('\n📊 Overall statistics:');
    const totalCount = await prisma.transaction.count();
    const expenseCount = await prisma.transaction.count({ where: { amount: { lt: 0 } } });
    const incomeCount = await prisma.transaction.count({ where: { amount: { gt: 0 } } });

    console.log(`Total transactions: ${totalCount}`);
    console.log(`Expense transactions: ${expenseCount}`);
    console.log(`Income transactions: ${incomeCount}`);

    // 5. تست appointment filter
    console.log('\n📅 Testing appointment filter:');
    const appointmentTransactions = await prisma.transaction.findMany({
      where: {
        appointment: {
          barberId: 2 // barber ID موجود
        }
      },
      take: 3,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true,
        appointment: {
          select: {
            id: true,
            barberId: true
          }
        }
      }
    });

    console.log(`Found ${appointmentTransactions.length} transactions for barber 2:`);
    appointmentTransactions.forEach((t, i) => {
      const sign = t.amount >= 0 ? '+' : '';
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: ${sign}${t.amount.toLocaleString('fa-IR')} - Appointment: ${t.appointment.id} (Barber: ${t.appointment.barberId})`);
    });

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testRecentTransactions();
