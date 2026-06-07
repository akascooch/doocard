const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addTestExpense() {
  console.log('💰 اضافه کردن تراکنش هزینه تست...\n');

  try {
    // دریافت یک نوبت موجود برای appointmentId
    const existingAppointment = await prisma.appointment.findFirst();
    if (!existingAppointment) {
      console.log('❌ هیچ نوبتی یافت نشد!');
      return;
    }

    // دریافت یک حساب بانکی
    const bankAccount = await prisma.bankAccount.findFirst();
    if (!bankAccount) {
      console.log('❌ هیچ حساب بانکی یافت نشد!');
      return;
    }

    // ایجاد تراکنش هزینه تست
    const testExpense = await prisma.transaction.create({
      data: {
        amount: -1000000, // مبلغ منفی برای هزینه
        paymentMethod: 'CASH',
        createdAt: new Date(),
        updatedAt: new Date(),
        appointmentId: existingAppointment.id,
        status: 'COMPLETED',
        category: 'OTHER',
        type: 'NORMAL',
        bankAccountId: bankAccount.id,
        description: 'هزینه تست - برای بررسی سیستم',
      },
    });

    console.log('✅ تراکنش هزینه تست اضافه شد:');
    console.log(`مبلغ: ${testExpense.amount} تومان`);
    console.log(`توضیحات: ${testExpense.description}`);
    console.log(`نوع: ${testExpense.type}`);
    console.log(`دسته‌بندی: ${testExpense.category}`);
    console.log(`وضعیت: ${testExpense.status}`);

    // بررسی آمار جدید
    const totalIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true },
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
    });

    console.log('\n💰 آمار جدید:');
    console.log(`درآمد کل: ${(totalIncome._sum.amount || 0).toLocaleString()} تومان`);
    console.log(`هزینه کل: ${Math.abs(totalExpense._sum.amount || 0).toLocaleString()} تومان`);
    console.log(`موجودی: ${((totalIncome._sum.amount || 0) - Math.abs(totalExpense._sum.amount || 0)).toLocaleString()} تومان`);

  } catch (error) {
    console.error('❌ خطا در اضافه کردن تراکنش تست:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestExpense(); 