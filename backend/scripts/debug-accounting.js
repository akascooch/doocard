const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugAccounting() {
  try {
    console.log('🔍 Debugging accounting data...\n');

    // 1. بررسی تراکنش‌ها
    console.log('📊 Checking transactions:');
    const transactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        appointment: true,
        barber: true,
        bankAccount: true
      }
    });

    console.log(`Found ${transactions.length} recent transactions:`);
    transactions.forEach((t, i) => {
      console.log(`${i + 1}. Amount: ${t.amount}, Category: ${t.category}, Date: ${t.createdAt}, Appointment: ${t.appointmentId}, Barber: ${t.barberId}, Bank: ${t.bankAccountId}`);
    });

    // 2. بررسی نوبت‌ها
    console.log('\n📅 Checking appointments:');
    const appointments = await prisma.appointment.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: {
        transactions: true,
        services: true
      }
    });

    console.log(`Found ${appointments.length} recent appointments:`);
    appointments.forEach((a, i) => {
      console.log(`${i + 1}. Date: ${a.date}, Status: ${a.status}, Transactions: ${a.transactions.length}, Services: ${a.services.length}`);
      if (a.transactions.length > 0) {
        a.transactions.forEach(t => {
          console.log(`   - Transaction: ${t.amount} (${t.category})`);
        });
      }
    });

    // 3. بررسی حساب‌های بانکی
    console.log('\n🏦 Checking bank accounts:');
    const bankAccounts = await prisma.bankAccount.findMany({
      include: {
        transactions: true
      }
    });

    console.log(`Found ${bankAccounts.length} bank accounts:`);
    bankAccounts.forEach((ba, i) => {
      const balance = ba.transactions.reduce((sum, t) => sum + t.amount, 0);
      console.log(`${i + 1}. ${ba.name}: ${ba.cardNumber}, Balance: ${balance}, Transactions: ${ba.transactions.length}`);
    });

    // 4. محاسبه آمار کلی
    console.log('\n📈 Calculating overall stats:');
    
    // کل درآمد (تراکنش‌های مثبت)
    const totalIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true }
    });

    // کل هزینه (تراکنش‌های منفی)
    const totalExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true }
    });

    console.log(`Total Income: ${totalIncome._sum.amount || 0}`);
    console.log(`Total Expense: ${Math.abs(totalExpense._sum.amount || 0)}`);

    // 5. بررسی تراکنش‌های 6 ماه گذشته
    console.log('\n📊 Checking last 6 months transactions:');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Found ${recentTransactions.length} transactions in last 6 months`);

    // گروه‌بندی بر اساس ماه
    const monthlyData = {};
    recentTransactions.forEach(t => {
      const monthKey = `${t.createdAt.getFullYear()}-${t.createdAt.getMonth()}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0 };
      }
      if (t.amount > 0) {
        monthlyData[monthKey].income += t.amount;
      } else {
        monthlyData[monthKey].expense += Math.abs(t.amount);
      }
    });

    console.log('Monthly breakdown:');
    Object.entries(monthlyData).forEach(([month, data]) => {
      console.log(`${month}: Income=${data.income}, Expense=${data.expense}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugAccounting(); 