const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAccountingFix() {
  try {
    console.log('🧪 Testing accounting fixes...\n');

    // 1. بررسی تراکنش‌های 6 ماه گذشته
    console.log('📊 Checking transactions for last 6 months:');
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: sixMonthsAgo }
      },
      orderBy: { createdAt: 'desc' },
      include: {
        appointment: true,
        barber: true,
        bankAccount: true
      }
    });

    console.log(`Found ${recentTransactions.length} transactions in last 6 months`);

    // گروه‌بندی بر اساس ماه
    const monthlyData = {};
    recentTransactions.forEach(t => {
      const monthKey = `${t.createdAt.getFullYear()}-${t.createdAt.getMonth()}`;
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { income: 0, expense: 0, count: 0 };
      }
      if (t.amount > 0) {
        monthlyData[monthKey].income += t.amount;
      } else {
        monthlyData[monthKey].expense += Math.abs(t.amount);
      }
      monthlyData[monthKey].count++;
    });

    console.log('\n📈 Monthly breakdown:');
    Object.keys(monthlyData).sort().forEach(month => {
      const data = monthlyData[month];
      const monthNames = [
        'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
        'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
      ];
      const monthName = monthNames[parseInt(month.split('-')[1])];
      const year = month.split('-')[0];
      console.log(`${monthName} ${year}: درآمد: ${data.income}, هزینه: ${data.expense}, تعداد: ${data.count}`);
    });

    // 2. بررسی نوبت‌ها و تراکنش‌هایشان
    console.log('\n📅 Checking appointments with transactions:');
    const appointmentsWithTransactions = await prisma.appointment.findMany({
      where: {
        date: { gte: sixMonthsAgo },
        transactions: { some: {} }
      },
      include: {
        transactions: {
          orderBy: { amount: 'desc' }
        },
        services: true
      },
      orderBy: { date: 'desc' }
    });

    console.log(`Found ${appointmentsWithTransactions.length} appointments with transactions`);

    let totalAppointmentIncome = 0;
    let totalAppointmentTips = 0;

    appointmentsWithTransactions.forEach(appointment => {
      if (appointment.transactions && appointment.transactions.length > 0) {
        if (appointment.transactions.length === 1) {
          totalAppointmentIncome += appointment.transactions[0].amount;
        } else {
          totalAppointmentIncome += appointment.transactions[0].amount;
          for (let i = 1; i < appointment.transactions.length; i++) {
            totalAppointmentTips += appointment.transactions[i].amount;
          }
        }
      }
    });

    console.log(`Total appointment income: ${totalAppointmentIncome}`);
    console.log(`Total appointment tips: ${totalAppointmentTips}`);

    // 3. بررسی تراکنش‌های مستقیم
    console.log('\n💰 Checking direct transactions:');
    const directIncomeTransactions = await prisma.transaction.aggregate({
      where: {
        amount: { gt: 0 },
        createdAt: { gte: sixMonthsAgo }
        // حذف فیلتر appointmentId که مشکل ایجاد می‌کرد
      },
      _sum: { amount: true }
    });

    const directExpenseTransactions = await prisma.transaction.aggregate({
      where: {
        amount: { lt: 0 },
        createdAt: { gte: sixMonthsAgo }
      },
      _sum: { amount: true }
    });

    console.log(`Direct income transactions: ${directIncomeTransactions._sum.amount || 0}`);
    console.log(`Direct expense transactions: ${Math.abs(directExpenseTransactions._sum.amount || 0)}`);

    // 4. بررسی FinancialEntry
    console.log('\n📋 Checking FinancialEntry:');
    const financialEntryIncomes = await prisma.financialEntry.aggregate({
      where: {
        type: 'INCOME',
        date: { gte: sixMonthsAgo }
      },
      _sum: { amount: true }
    });

    const financialEntryExpenses = await prisma.financialEntry.aggregate({
      where: {
        type: 'EXPENSE',
        date: { gte: sixMonthsAgo }
      },
      _sum: { amount: true }
    });

    console.log(`FinancialEntry income: ${financialEntryIncomes._sum.amount || 0}`);
    console.log(`FinancialEntry expense: ${financialEntryExpenses._sum.amount || 0}`);

    // 5. محاسبه کل
    const totalIncome = totalAppointmentIncome + totalAppointmentTips + (directIncomeTransactions._sum.amount || 0) + (financialEntryIncomes._sum.amount || 0);
    const totalExpense = Math.abs(directExpenseTransactions._sum.amount || 0) + (financialEntryExpenses._sum.amount || 0);
    const balance = totalIncome - totalExpense;

    console.log('\n📊 Summary:');
    console.log(`Total Income: ${totalIncome}`);
    console.log(`Total Expense: ${totalExpense}`);
    console.log(`Balance: ${balance}`);

    // 6. تست API endpoint
    console.log('\n🌐 Testing API endpoint simulation:');
    console.log('This would call /accounting/stats with date filters');
    console.log('Expected response should match the calculations above');

  } catch (error) {
    console.error('❌ Error testing accounting fix:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAccountingFix();
