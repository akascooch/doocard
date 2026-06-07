const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function finalTest() {
  try {
    console.log('🧪 Final test of accounting system...\n');

    // 1. بررسی تراکنش‌ها
    console.log('📊 Checking transactions:');
    const transactionCount = await prisma.transaction.count();
    console.log(`Total transactions: ${transactionCount}`);

    if (transactionCount > 0) {
      const recentTransactions = await prisma.transaction.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          appointment: true,
          barber: true,
          bankAccount: true
        }
      });

      console.log('\nRecent transactions:');
      recentTransactions.forEach((t, i) => {
        console.log(`${i + 1}. Amount: ${t.amount}, Category: ${t.category}, Date: ${t.createdAt.toLocaleDateString('fa-IR')}`);
      });
    }

    // 2. بررسی نوبت‌ها
    console.log('\n📅 Checking appointments:');
    const appointmentCount = await prisma.appointment.count();
    console.log(`Total appointments: ${appointmentCount}`);

    if (appointmentCount > 0) {
      const recentAppointments = await prisma.appointment.findMany({
        take: 3,
        orderBy: { date: 'desc' },
        include: {
          transactions: true,
          services: true
        }
      });

      console.log('\nRecent appointments:');
      recentAppointments.forEach((a, i) => {
        console.log(`${i + 1}. Date: ${a.date.toLocaleDateString('fa-IR')}, Status: ${a.status}, Transactions: ${a.transactions.length}`);
      });
    }

    // 3. بررسی حساب‌های بانکی
    console.log('\n🏦 Checking bank accounts:');
    const bankAccounts = await prisma.bankAccount.findMany();
    console.log(`Total bank accounts: ${bankAccounts.length}`);

    for (const account of bankAccounts) {
      const accountTransactions = await prisma.transaction.aggregate({
        where: { bankAccountId: account.id },
        _sum: { amount: true }
      });
      
      const balance = accountTransactions._sum.amount || 0;
      console.log(`- ${account.name}: ${balance}`);
    }

    // 4. محاسبه آمار کلی
    console.log('\n📈 Calculating overall stats:');
    
    const totalIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true }
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true }
    });

    const income = totalIncome._sum.amount || 0;
    const expense = Math.abs(totalExpense._sum.amount || 0);
    const balance = income - expense;

    console.log(`Total Income: ${income.toLocaleString('fa-IR')}`);
    console.log(`Total Expense: ${expense.toLocaleString('fa-IR')}`);
    console.log(`Balance: ${balance.toLocaleString('fa-IR')}`);

    // 5. بررسی آمار 6 ماه گذشته
    console.log('\n📊 Last 6 months analysis:');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentIncome = await prisma.transaction.aggregate({
      where: {
        amount: { gt: 0 },
        createdAt: { gte: sixMonthsAgo }
      },
      _sum: { amount: true }
    });

    const recentExpense = await prisma.transaction.aggregate({
      where: {
        amount: { lt: 0 },
        createdAt: { gte: sixMonthsAgo }
      },
      _sum: { amount: true }
    });

    const recentIncomeTotal = recentIncome._sum.amount || 0;
    const recentExpenseTotal = Math.abs(recentExpense._sum.amount || 0);
    const recentBalance = recentIncomeTotal - recentExpenseTotal;

    console.log(`Last 6 months - Income: ${recentIncomeTotal.toLocaleString('fa-IR')}`);
    console.log(`Last 6 months - Expense: ${recentExpenseTotal.toLocaleString('fa-IR')}`);
    console.log(`Last 6 months - Balance: ${recentBalance.toLocaleString('fa-IR')}`);

    // 6. بررسی آرایشگران
    console.log('\n👨‍💼 Checking barbers:');
    const barbers = await prisma.barber.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        balance: true
      }
    });

    console.log(`Total barbers: ${barbers.length}`);
    barbers.forEach(barber => {
      console.log(`- ${barber.firstName} ${barber.lastName}: ${barber.balance || 0}`);
    });

    console.log('\n✅ Final test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`- Transactions: ${transactionCount}`);
    console.log(`- Appointments: ${appointmentCount}`);
    console.log(`- Bank Accounts: ${bankAccounts.length}`);
    console.log(`- Barbers: ${barbers.length}`);
    console.log(`- Total Balance: ${balance.toLocaleString('fa-IR')}`);

  } catch (error) {
    console.error('❌ Error in final test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

finalTest();
