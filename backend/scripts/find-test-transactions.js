const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findTestTransactions() {
  console.log('🔍 جستجوی تراکنش‌های تست...\n');

  try {
    // جستجوی تراکنش‌های اخیر
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { description: { contains: 'تست', mode: 'insensitive' } },
          { description: { contains: 'test', mode: 'insensitive' } },
        ]
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    console.log(`📊 تعداد تراکنش‌های تست یافت شده: ${recentTransactions.length}`);

    if (recentTransactions.length > 0) {
      console.log('\n📋 جزئیات تراکنش‌های تست:');
      recentTransactions.forEach((transaction, index) => {
        console.log(`${index + 1}. مبلغ: ${transaction.amount}, نوع: ${transaction.type}, وضعیت: ${transaction.status}`);
        console.log(`   توضیحات: ${transaction.description}`);
        console.log(`   تاریخ: ${transaction.createdAt}`);
        console.log(`   حساب بانکی: ${transaction.bankAccountId || 'نامشخص'}`);
        console.log('---');
      });
    } else {
      console.log('❌ هیچ تراکنش تستی یافت نشد!');
    }

    // جستجوی تراکنش‌های منفی اخیر
    const recentExpenses = await prisma.transaction.findMany({
      where: {
        amount: { lt: 0 }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });

    console.log('\n💰 آخرین هزینه‌ها:');
    recentExpenses.forEach((expense, index) => {
      console.log(`${index + 1}. مبلغ: ${expense.amount}, توضیحات: ${expense.description}, تاریخ: ${expense.createdAt}`);
    });

  } catch (error) {
    console.error('❌ خطا در جستجو:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findTestTransactions(); 