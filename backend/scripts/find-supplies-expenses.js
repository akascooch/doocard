const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findSuppliesExpenses() {
  console.log('🔍 جستجوی تراکنش‌های هزینه خرید لوازم...\n');

  try {
    // جستجوی تراکنش‌های با دسته‌بندی SUPPLIES
    console.log('📊 جستجوی تراکنش‌های با دسته‌بندی SUPPLIES');
    const suppliesTransactions = await prisma.transaction.findMany({
      where: {
        category: 'SUPPLIES'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log(`تعداد تراکنش‌های دسته‌بندی SUPPLIES: ${suppliesTransactions.length}`);

    if (suppliesTransactions.length > 0) {
      console.log('\n📋 تراکنش‌های خرید لوازم:');
      suppliesTransactions.forEach((transaction, index) => {
        const type = transaction.amount > 0 ? 'درآمد' : 'هزینه';
        console.log(`${index + 1}. ${type}: ${Math.abs(transaction.amount)}, توضیحات: ${transaction.description || 'بدون توضیح'}`);
        console.log(`   نوع: ${transaction.type}, دسته‌بندی: ${transaction.category}, وضعیت: ${transaction.status}`);
        console.log(`   تاریخ: ${transaction.createdAt}`);
        console.log('---');
      });
    }

    // جستجوی تراکنش‌های با کلمات کلیدی مرتبط با لوازم
    console.log('\n📊 جستجوی تراکنش‌های با کلمات کلیدی لوازم');
    const suppliesKeywords = await prisma.transaction.findMany({
      where: {
        OR: [
          { description: { contains: 'لوازم' } },
          { description: { contains: 'مواد' } },
          { description: { contains: 'خرید' } },
          { description: { contains: 'supplies' } },
          { description: { contains: 'مواد مصرفی' } },
          { description: { contains: 'ابزار' } },
          { description: { contains: 'تجهیزات' } },
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log(`تعداد تراکنش‌های با کلمات کلیدی لوازم: ${suppliesKeywords.length}`);

    if (suppliesKeywords.length > 0) {
      console.log('\n📋 تراکنش‌های با کلمات کلیدی لوازم:');
      suppliesKeywords.forEach((transaction, index) => {
        const type = transaction.amount > 0 ? 'درآمد' : 'هزینه';
        console.log(`${index + 1}. ${type}: ${Math.abs(transaction.amount)}, توضیحات: ${transaction.description}`);
        console.log(`   نوع: ${transaction.type}, دسته‌بندی: ${transaction.category}, وضعیت: ${transaction.status}`);
        console.log(`   تاریخ: ${transaction.createdAt}`);
        console.log('---');
      });
    }

    // جستجوی همه تراکنش‌های منفی (هزینه)
    console.log('\n📊 جستجوی همه تراکنش‌های منفی');
    const allNegativeTransactions = await prisma.transaction.findMany({
      where: {
        amount: { lt: 0 }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log(`تعداد کل تراکنش‌های منفی: ${allNegativeTransactions.length}`);

    if (allNegativeTransactions.length > 0) {
      console.log('\n📋 همه تراکنش‌های منفی:');
      allNegativeTransactions.forEach((transaction, index) => {
        console.log(`${index + 1}. مبلغ: ${transaction.amount}, توضیحات: ${transaction.description || 'بدون توضیح'}`);
        console.log(`   نوع: ${transaction.type}, دسته‌بندی: ${transaction.category}, وضعیت: ${transaction.status}`);
        console.log(`   تاریخ: ${transaction.createdAt}`);
        console.log('---');
      });
    }

    // نمایش آمار کلی
    console.log('\n💰 آمار کلی:');
    const totalIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true },
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
    });

    console.log(`درآمد کل: ${(totalIncome._sum.amount || 0).toLocaleString()} تومان`);
    console.log(`هزینه کل: ${Math.abs(totalExpense._sum.amount || 0).toLocaleString()} تومان`);
    console.log(`موجودی: ${((totalIncome._sum.amount || 0) - Math.abs(totalExpense._sum.amount || 0)).toLocaleString()} تومان`);

  } catch (error) {
    console.error('❌ خطا در جستجو:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findSuppliesExpenses(); 