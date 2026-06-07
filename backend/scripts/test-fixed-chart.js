const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testFixedChart() {
  try {
    console.log('🧪 Testing fixed chart logic...\n');

    // 1. بررسی تراکنش‌های مرداد (August)
    console.log('📊 مرداد ماه (August) transactions:');
    const augustTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: new Date('2025-08-01'),
          lt: new Date('2025-09-01')
        }
      },
      select: {
        id: true,
        amount: true,
        category: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    console.log(`Found ${augustTransactions.length} August transactions:`);
    augustTransactions.forEach((t, i) => {
      const monthIndex = t.createdAt.getMonth(); // 0-11
      const year = t.createdAt.getFullYear();
      
      // تبدیل ماه میلادی به نام فارسی
      let persianMonthName;
      let persianMonthIndex;
      
      switch (monthIndex) {
        case 0: persianMonthName = 'دی'; persianMonthIndex = 10; break;
        case 1: persianMonthName = 'بهمن'; persianMonthIndex = 11; break;
        case 2: persianMonthName = 'اسفند'; persianMonthIndex = 12; break;
        case 3: persianMonthName = 'فروردین'; persianMonthIndex = 1; break;
        case 4: persianMonthName = 'اردیبهشت'; persianMonthIndex = 2; break;
        case 5: persianMonthName = 'خرداد'; persianMonthIndex = 3; break;
        case 6: persianMonthName = 'تیر'; persianMonthIndex = 4; break;
        case 7: persianMonthName = 'مرداد'; persianMonthIndex = 5; break;
        case 8: persianMonthName = 'شهریور'; persianMonthIndex = 6; break;
        case 9: persianMonthName = 'مهر'; persianMonthIndex = 7; break;
        case 10: persianMonthName = 'آبان'; persianMonthIndex = 8; break;
        case 11: persianMonthName = 'آذر'; persianMonthIndex = 9; break;
        default: persianMonthName = 'نامشخص'; persianMonthIndex = monthIndex + 1;
      }
      
      const sign = t.amount >= 0 ? '+' : '';
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: ${sign}${t.amount.toLocaleString('fa-IR')}`);
      console.log(`   میلادی: ${t.createdAt.toLocaleDateString('en-US')} (Month: ${monthIndex + 1})`);
      console.log(`   فارسی: ${persianMonthName} (Index: ${persianMonthIndex})`);
      console.log(`   monthKey: ${year}-${persianMonthIndex}`);
      console.log('');
    });

    // 2. شبیه‌سازی منطق نمودار جدید
    console.log('📈 Testing new chart logic:');
    const allTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: new Date('2025-07-01'),
          lt: new Date('2025-11-01')
        }
      },
      select: {
        amount: true,
        createdAt: true,
        category: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Total transactions in range: ${allTransactions.length}`);

    const monthlyData = new Map();
    
    allTransactions.forEach((transaction, index) => {
      const monthIndex = transaction.createdAt.getMonth(); // 0-11
      const year = transaction.createdAt.getFullYear();
      
      // تبدیل ماه میلادی به نام فارسی
      let persianMonthName;
      let persianMonthIndex;
      
      switch (monthIndex) {
        case 0: persianMonthName = 'دی'; persianMonthIndex = 10; break;
        case 1: persianMonthName = 'بهمن'; persianMonthIndex = 11; break;
        case 2: persianMonthName = 'اسفند'; persianMonthIndex = 12; break;
        case 3: persianMonthName = 'فروردین'; persianMonthIndex = 1; break;
        case 4: persianMonthName = 'اردیبهشت'; persianMonthIndex = 2; break;
        case 5: persianMonthName = 'خرداد'; persianMonthIndex = 3; break;
        case 6: persianMonthName = 'تیر'; persianMonthIndex = 4; break;
        case 7: persianMonthName = 'مرداد'; persianMonthIndex = 5; break;
        case 8: persianMonthName = 'شهریور'; persianMonthIndex = 6; break;
        case 9: persianMonthName = 'مهر'; persianMonthIndex = 7; break;
        case 10: persianMonthName = 'آبان'; persianMonthIndex = 8; break;
        case 11: persianMonthName = 'آذر'; persianMonthIndex = 9; break;
        default: persianMonthName = 'نامشخص'; persianMonthIndex = monthIndex + 1;
      }
      
      const monthKey = `${year}-${persianMonthIndex}`;
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { income: 0, expense: 0, count: 0, transactions: [] });
      }
      
      const data = monthlyData.get(monthKey);
      if (transaction.amount >= 0) {
        data.income += transaction.amount;
      } else {
        data.expense += Math.abs(transaction.amount);
      }
      data.count++;
      data.transactions.push({
        id: index,
        amount: transaction.amount,
        date: transaction.createdAt.toLocaleDateString('en-US'),
        persianMonth: persianMonthName,
        persianMonthIndex
      });
    });

    console.log('\nMonthly breakdown:');
    monthlyData.forEach((data, monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);
      
      // تبدیل شماره ماه به نام فارسی
      let persianMonthName;
      switch (month) {
        case 1: persianMonthName = 'فروردین'; break;
        case 2: persianMonthName = 'اردیبهشت'; break;
        case 3: persianMonthName = 'خرداد'; break;
        case 4: persianMonthName = 'تیر'; break;
        case 5: persianMonthName = 'مرداد'; break;
        case 6: persianMonthName = 'شهریور'; break;
        case 7: persianMonthName = 'مهر'; break;
        case 8: persianMonthName = 'آبان'; break;
        case 9: persianMonthName = 'آذر'; break;
        case 10: persianMonthName = 'دی'; break;
        case 11: persianMonthName = 'بهمن'; break;
        case 12: persianMonthName = 'اسفند'; break;
        default: persianMonthName = 'نامشخص';
      }
      
      console.log(`${year}/${month} (${persianMonthName}): ${data.count} transactions`);
      console.log(`  Income: ${data.income.toLocaleString('fa-IR')}, Expense: ${data.expense.toLocaleString('fa-IR')}`);
      console.log(`  Transactions: ${data.transactions.map(t => `${t.date}(${t.persianMonth})`).join(', ')}`);
      console.log('');
    });

    console.log('✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testFixedChart();
