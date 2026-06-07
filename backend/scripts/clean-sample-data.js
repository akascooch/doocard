const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanSampleData() {
  console.log('🧹 پاک کردن داده‌های نمونه...\n');

  try {
    // پیدا کردن تراکنش‌های نمونه (هزینه‌های اضافه شده)
    const sampleExpenses = await prisma.transaction.findMany({
      where: {
        OR: [
          { description: { contains: 'اجاره ماهانه' } },
          { description: { contains: 'قبوض آب و برق' } },
          { description: { contains: 'مواد مصرفی' } },
          { description: { contains: 'حقوق کارکنان' } },
          { description: { contains: 'تعمیرات' } },
          { description: { contains: 'بیمه' } },
          { description: { contains: 'تبلیغات' } },
          { description: { contains: 'حمل و نقل' } },
          { description: { contains: 'موجودی اولیه' } },
        ]
      }
    });

    console.log(`📊 تعداد تراکنش‌های نمونه یافت شده: ${sampleExpenses.length}`);

    if (sampleExpenses.length > 0) {
      console.log('\n📋 تراکنش‌های نمونه:');
      sampleExpenses.forEach((expense, index) => {
        console.log(`${index + 1}. مبلغ: ${expense.amount}, توضیحات: ${expense.description}, تاریخ: ${expense.createdAt}`);
      });

      // حذف تراکنش‌های نمونه
      const deleteResult = await prisma.transaction.deleteMany({
        where: {
          OR: [
            { description: { contains: 'اجاره ماهانه' } },
            { description: { contains: 'قبوض آب و برق' } },
            { description: { contains: 'مواد مصرفی' } },
            { description: { contains: 'حقوق کارکنان' } },
            { description: { contains: 'تعمیرات' } },
            { description: { contains: 'بیمه' } },
            { description: { contains: 'تبلیغات' } },
            { description: { contains: 'حمل و نقل' } },
            { description: { contains: 'موجودی اولیه' } },
          ]
        }
      });

      console.log(`\n✅ ${deleteResult.count} تراکنش نمونه حذف شد!`);
    } else {
      console.log('✅ هیچ تراکنش نمونه‌ای یافت نشد!');
    }

    // نمایش آمار جدید
    const totalIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true },
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
    });

    console.log('\n💰 آمار مالی پس از پاک‌سازی:');
    console.log(`درآمد کل: ${totalIncome._sum.amount || 0}`);
    console.log(`هزینه کل: ${Math.abs(totalExpense._sum.amount || 0)}`);
    console.log(`موجودی: ${(totalIncome._sum.amount || 0) - Math.abs(totalExpense._sum.amount || 0)}`);

  } catch (error) {
    console.error('❌ خطا در پاک کردن داده‌های نمونه:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanSampleData(); 