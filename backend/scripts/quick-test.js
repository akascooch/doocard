const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function quickTest() {
  try {
    console.log('🧪 Quick test of accounting data...\n');

    // 1. بررسی تعداد تراکنش‌ها
    const transactionCount = await prisma.transaction.count();
    console.log(`📊 Total transactions: ${transactionCount}`);

    // 2. بررسی تراکنش‌های مثبت (درآمد)
    const incomeTransactions = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true }
    });
    console.log(`💰 Total income: ${incomeTransactions._sum.amount || 0}`);

    // 3. بررسی تراکنش‌های منفی (هزینه)
    const expenseTransactions = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true }
    });
    console.log(`💸 Total expenses: ${Math.abs(expenseTransactions._sum.amount || 0)}`);

    // 4. بررسی نوبت‌ها
    const appointmentCount = await prisma.appointment.count();
    console.log(`📅 Total appointments: ${appointmentCount}`);

    // 5. بررسی نوبت‌های با تراکنش
    const appointmentsWithTransactions = await prisma.appointment.count({
      where: {
        transactions: { some: {} }
      }
    });
    console.log(`💳 Appointments with transactions: ${appointmentsWithTransactions}`);

    // 6. محاسبه موجودی
    const balance = (incomeTransactions._sum.amount || 0) - Math.abs(expenseTransactions._sum.amount || 0);
    console.log(`🏦 Balance: ${balance}`);

    console.log('\n✅ Quick test completed successfully!');

  } catch (error) {
    console.error('❌ Error in quick test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickTest();
