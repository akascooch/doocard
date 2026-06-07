const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findAllExpenses() {
  console.log('🔍 جستجوی همه تراکنش‌های هزینه...\n');

  try {
    // روش 1: جستجوی تراکنش‌های منفی
    console.log('📊 روش 1: جستجوی تراکنش‌های منفی');
    const negativeTransactions = await prisma.transaction.findMany({
      where: {
        amount: { lt: 0 }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log(`تعداد تراکنش‌های منفی: ${negativeTransactions.length}`);

    // روش 2: جستجوی تراکنش‌های با نوع NORMAL (که ممکن است هزینه باشند)
    console.log('\n📊 روش 2: جستجوی تراکنش‌های با نوع NORMAL');
    const normalTransactions = await prisma.transaction.findMany({
      where: {
        type: 'NORMAL'
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log(`تعداد تراکنش‌های نوع NORMAL: ${normalTransactions.length}`);

    // روش 3: جستجوی تراکنش‌های با دسته‌بندی هزینه
    console.log('\n📊 روش 3: جستجوی تراکنش‌های با دسته‌بندی هزینه');
    const expenseCategoryTransactions = await prisma.transaction.findMany({
      where: {
        category: {
          in: ['RENT', 'UTILITY', 'SUPPLIES', 'SALARY', 'OTHER']
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log(`تعداد تراکنش‌های دسته‌بندی هزینه: ${expenseCategoryTransactions.length}`);

    // روش 4: جستجوی همه تراکنش‌ها و فیلتر کردن
    console.log('\n📊 روش 4: جستجوی همه تراکنش‌ها');
    const allTransactions = await prisma.transaction.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    const expenses = allTransactions.filter(t => t.amount < 0);
    console.log(`تعداد تراکنش‌های منفی در 50 تراکنش آخر: ${expenses.length}`);

    if (expenses.length > 0) {
      console.log('\n📋 تراکنش‌های منفی یافت شده:');
      expenses.forEach((expense, index) => {
        console.log(`${index + 1}. مبلغ: ${expense.amount}, توضیحات: ${expense.description || 'بدون توضیح'}`);
        console.log(`   نوع: ${expense.type}, دسته‌بندی: ${expense.category}, وضعیت: ${expense.status}`);
        console.log(`   تاریخ: ${expense.createdAt}`);
        console.log('---');
      });
    }

    // روش 5: جستجوی تراکنش‌های با کلمات کلیدی هزینه
    console.log('\n📊 روش 5: جستجوی تراکنش‌های با کلمات کلیدی');
    const keywordExpenses = await prisma.transaction.findMany({
      where: {
        OR: [
          { description: { contains: 'هزینه' } },
          { description: { contains: 'expense' } },
          { description: { contains: 'خرج' } },
          { description: { contains: 'پرداخت' } },
          { description: { contains: 'اجاره' } },
          { description: { contains: 'قبض' } },
          { description: { contains: 'حقوق' } },
          { description: { contains: 'مواد' } },
          { description: { contains: 'تعمیر' } },
          { description: { contains: 'تست' } },
        ]
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    console.log(`تعداد تراکنش‌های با کلمات کلیدی: ${keywordExpenses.length}`);

    if (keywordExpenses.length > 0) {
      console.log('\n📋 تراکنش‌های با کلمات کلیدی:');
      keywordExpenses.forEach((transaction, index) => {
        const type = transaction.amount > 0 ? 'درآمد' : 'هزینه';
        console.log(`${index + 1}. ${type}: ${Math.abs(transaction.amount)}, توضیحات: ${transaction.description}`);
        console.log(`   نوع: ${transaction.type}, دسته‌بندی: ${transaction.category}, وضعیت: ${transaction.status}`);
        console.log('---');
      });
    }

    // روش 6: نمایش همه تراکنش‌های اخیر
    console.log('\n📊 روش 6: نمایش 10 تراکنش اخیر');
    const recentTransactions = await prisma.transaction.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    recentTransactions.forEach((transaction, index) => {
      const type = transaction.amount > 0 ? 'درآمد' : 'هزینه';
      console.log(`${index + 1}. ${type}: ${Math.abs(transaction.amount)}, توضیحات: ${transaction.description || 'بدون توضیح'}`);
      console.log(`   نوع: ${transaction.type}, دسته‌بندی: ${transaction.category}, وضعیت: ${transaction.status}`);
      console.log('---');
    });

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

findAllExpenses(); 