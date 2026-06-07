const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addSuppliesExpense() {
  console.log('💰 اضافه کردن تراکنش هزینه خرید لوازم...\n');

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

    // ایجاد تراکنش هزینه خرید لوازم
    const suppliesExpense = await prisma.transaction.create({
      data: {
        amount: -2500000, // مبلغ منفی برای هزینه
        paymentMethod: 'CASH',
        createdAt: new Date(),
        updatedAt: new Date(),
        appointmentId: existingAppointment.id,
        status: 'COMPLETED',
        category: 'SUPPLIES',
        type: 'NORMAL',
        bankAccountId: bankAccount.id,
        description: 'خرید لوازم آرایشگاه - قیچی، شانه، مواد آرایشی',
      },
    });

    console.log('✅ تراکنش هزینه خرید لوازم اضافه شد:');
    console.log(`مبلغ: ${suppliesExpense.amount} تومان`);
    console.log(`توضیحات: ${suppliesExpense.description}`);
    console.log(`نوع: ${suppliesExpense.type}`);
    console.log(`دسته‌بندی: ${suppliesExpense.category}`);
    console.log(`وضعیت: ${suppliesExpense.status}`);

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
    console.error('❌ خطا در اضافه کردن تراکنش خرید لوازم:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSuppliesExpense(); 