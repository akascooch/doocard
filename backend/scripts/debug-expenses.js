const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugExpenses() {
  console.log('🔍 دیباگ تراکنش‌های هزینه...\n');

  try {
    // جستجوی همه تراکنش‌های منفی
    const allExpenses = await prisma.transaction.findMany({
      where: {
        amount: { lt: 0 }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 تعداد کل تراکنش‌های منفی: ${allExpenses.length}`);

    if (allExpenses.length > 0) {
      console.log('\n📋 همه تراکنش‌های منفی:');
      allExpenses.forEach((expense, index) => {
        console.log(`${index + 1}. مبلغ: ${expense.amount}, توضیحات: ${expense.description || 'بدون توضیح'}`);
        console.log(`   نوع: ${expense.type}, وضعیت: ${expense.status}, تاریخ: ${expense.createdAt}`);
        console.log(`   حساب بانکی: ${expense.bankAccountId || 'نامشخص'}`);
        console.log('---');
      });
    } else {
      console.log('❌ هیچ تراکنش منفی یافت نشد!');
    }

    // جستجوی تراکنش‌های با کلمه "تست"
    const testTransactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { description: { contains: 'تست' } },
          { description: { contains: 'test' } },
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`\n🔍 تعداد تراکنش‌های با کلمه "تست": ${testTransactions.length}`);

    if (testTransactions.length > 0) {
      console.log('\n📋 تراکنش‌های تست:');
      testTransactions.forEach((transaction, index) => {
        const type = transaction.amount > 0 ? 'درآمد' : 'هزینه';
        console.log(`${index + 1}. ${type}: ${Math.abs(transaction.amount)}, توضیحات: ${transaction.description}`);
        console.log(`   نوع: ${transaction.type}, وضعیت: ${transaction.status}, تاریخ: ${transaction.createdAt}`);
        console.log('---');
      });
    }

    // بررسی آمار کلی
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

    // بررسی تعداد کل تراکنش‌ها
    const totalTransactions = await prisma.transaction.count();
    console.log(`\n📊 تعداد کل تراکنش‌ها: ${totalTransactions}`);

  } catch (error) {
    console.error('❌ خطا در دیباگ:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugExpenses(); 