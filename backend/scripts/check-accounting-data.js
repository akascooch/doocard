const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkAccountingData() {
  console.log('🔍 بررسی داده‌های حسابداری...\n');

  try {
    // بررسی نوبت‌ها
    const appointments = await prisma.appointment.findMany({
      include: {
        transactions: true,
      },
    });
    console.log(`📅 تعداد نوبت‌ها: ${appointments.length}`);

    // بررسی تراکنش‌ها
    const transactions = await prisma.transaction.findMany();
    console.log(`💰 تعداد تراکنش‌ها: ${transactions.length}`);

    // بررسی حساب‌های بانکی
    const bankAccounts = await prisma.bankAccount.findMany();
    console.log(`🏦 تعداد حساب‌های بانکی: ${bankAccounts.length}`);

    // بررسی آرایشگران
    const barbers = await prisma.barber.findMany();
    console.log(`✂️ تعداد آرایشگران: ${barbers.length}`);

    // بررسی خدمات
    const services = await prisma.service.findMany();
    console.log(`🔧 تعداد خدمات: ${services.length}`);

    // بررسی مشتریان
    const customers = await prisma.customer.findMany();
    console.log(`👥 تعداد مشتریان: ${customers.length}`);

    // بررسی کاربران
    const users = await prisma.user.findMany();
    console.log(`👤 تعداد کاربران: ${users.length}`);

    console.log('\n📊 جزئیات تراکنش‌ها:');
    if (transactions.length > 0) {
      transactions.forEach((t, index) => {
        console.log(`${index + 1}. مبلغ: ${t.amount}, نوع: ${t.type}, وضعیت: ${t.status}, تاریخ: ${t.createdAt}`);
      });
    } else {
      console.log('❌ هیچ تراکنشی یافت نشد!');
    }

    console.log('\n🏦 جزئیات حساب‌های بانکی:');
    if (bankAccounts.length > 0) {
      bankAccounts.forEach((account, index) => {
        console.log(`${index + 1}. نام: ${account.name}, شماره کارت: ${account.cardNumber}`);
      });
    } else {
      console.log('❌ هیچ حساب بانکی یافت نشد!');
    }

    console.log('\n📅 جزئیات نوبت‌ها:');
    if (appointments.length > 0) {
      appointments.forEach((appointment, index) => {
        console.log(`${index + 1}. تاریخ: ${appointment.date}, تراکنش‌ها: ${appointment.transactions.length}`);
      });
    } else {
      console.log('❌ هیچ نوبتی یافت نشد!');
    }

    // محاسبه آمار مالی
    console.log('\n💰 آمار مالی:');
    
    // جمع تراکنش‌های مثبت (درآمد)
    const incomeTransactions = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true },
    });
    console.log(`درآمد کل: ${incomeTransactions._sum.amount || 0}`);

    // جمع تراکنش‌های منفی (هزینه)
    const expenseTransactions = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
    });
    console.log(`هزینه کل: ${Math.abs(expenseTransactions._sum.amount || 0)}`);

    // موجودی حساب‌های بانکی
    let totalBankBalance = 0;
    for (const account of bankAccounts) {
      const accountTransactions = await prisma.transaction.aggregate({
        where: { bankAccountId: account.id },
        _sum: { amount: true },
      });
      totalBankBalance += accountTransactions._sum.amount || 0;
    }
    console.log(`موجودی کل حساب‌های بانکی: ${totalBankBalance}`);

  } catch (error) {
    console.error('❌ خطا در بررسی داده‌ها:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccountingData(); 