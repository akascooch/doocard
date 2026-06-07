const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function showRecentTransactions() {
  console.log('📊 نمایش آخرین تراکنش‌ها...\n');

  try {
    // نمایش آخرین 20 تراکنش
    const recentTransactions = await prisma.transaction.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    });

    console.log(`📋 آخرین ${recentTransactions.length} تراکنش:`);
    recentTransactions.forEach((transaction, index) => {
      const type = transaction.amount > 0 ? 'درآمد' : 'هزینه';
      const amount = Math.abs(transaction.amount);
      console.log(`${index + 1}. ${type}: ${amount.toLocaleString()} تومان`);
      console.log(`   توضیحات: ${transaction.description || 'بدون توضیح'}`);
      console.log(`   نوع: ${transaction.type}, وضعیت: ${transaction.status}`);
      console.log(`   تاریخ: ${transaction.createdAt}`);
      console.log(`   حساب بانکی: ${transaction.bankAccountId || 'نامشخص'}`);
      console.log('---');
    });

    // نمایش آمار کلی
    const totalIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true },
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
    });

    console.log('\n💰 آمار کلی:');
    console.log(`درآمد کل: ${(totalIncome._sum.amount || 0).toLocaleString()} تومان`);
    console.log(`هزینه کل: ${Math.abs(totalExpense._sum.amount || 0).toLocaleString()} تومان`);
    console.log(`موجودی: ${((totalIncome._sum.amount || 0) - Math.abs(totalExpense._sum.amount || 0)).toLocaleString()} تومان`);

  } catch (error) {
    console.error('❌ خطا در نمایش تراکنش‌ها:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showRecentTransactions(); 