const { PrismaClient } = require('@prisma/client');
const jalaali = require('jalaali-js');

const prisma = new PrismaClient();

async function debugChartDates() {
  try {
    console.log('🔍 Debugging chart date calculations...\n');

    // 1. بررسی دقیق تراکنش‌های مرداد
    console.log('📊 مرداد ماه transactions:');
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
      const { jy, jm, jd } = jalaali.toJalaali(
        t.createdAt.getFullYear(),
        t.createdAt.getMonth() + 1,
        t.createdAt.getDate()
      );
      
      const sign = t.amount >= 0 ? '+' : '';
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: ${sign}${t.amount.toLocaleString('fa-IR')}`);
      console.log(`   میلادی: ${t.createdAt.toLocaleDateString('en-US')} (${t.createdAt.getMonth() + 1})`);
      console.log(`   شمسی: ${jy}/${jm}/${jd} (ماه ${jm})`);
      console.log(`   monthKey: ${jy}-${jm}`);
      console.log('');
    });

    // 2. بررسی دقیق تراکنش‌های مهر
    console.log('📊 مهر ماه transactions:');
    const octoberTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: new Date('2025-10-01'),
          lt: new Date('2025-11-01')
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

    console.log(`Found ${octoberTransactions.length} October transactions:`);
    octoberTransactions.forEach((t, i) => {
      const { jy, jm, jd } = jalaali.toJalaali(
        t.createdAt.getFullYear(),
        t.createdAt.getMonth() + 1,
        t.createdAt.getDate()
      );
      
      const sign = t.amount >= 0 ? '+' : '';
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: ${sign}${t.amount.toLocaleString('fa-IR')}`);
      console.log(`   میلادی: ${t.createdAt.toLocaleDateString('en-US')} (${t.createdAt.getMonth() + 1})`);
      console.log(`   شمسی: ${jy}/${jm}/${jd} (ماه ${jm})`);
      console.log(`   monthKey: ${jy}-${jm}`);
      console.log('');
    });

    // 3. تست دقیق تبدیل تاریخ‌ها
    console.log('🔄 Testing exact date conversions:');
    const testDates = [
      { date: new Date('2025-08-01'), name: '1 مرداد' },
      { date: new Date('2025-08-15'), name: '15 مرداد' },
      { date: new Date('2025-08-31'), name: '31 مرداد' },
      { date: new Date('2025-10-01'), name: '1 مهر' },
      { date: new Date('2025-10-15'), name: '15 مهر' },
      { date: new Date('2025-10-31'), name: '31 مهر' },
    ];

    testDates.forEach(({ date, name }) => {
      const { jy, jm, jd } = jalaali.toJalaali(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      
      const persianMonths = [
        'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
        'مرداد', 'شهریور', 'مهر', 'آبان',
        'آذر', 'دی', 'بهمن', 'اسفند'
      ];
      
      console.log(`${name}:`);
      console.log(`  میلادی: ${date.toLocaleDateString('en-US')} (Month: ${date.getMonth() + 1})`);
      console.log(`  شمسی: ${jy}/${jm}/${jd} (${persianMonths[jm - 1]})`);
      console.log(`  monthKey: ${jy}-${jm}`);
      console.log('');
    });

    // 4. شبیه‌سازی دقیق منطق نمودار
    console.log('📈 Simulating exact chart logic:');
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
      const { jy, jm } = jalaali.toJalaali(
        transaction.createdAt.getFullYear(),
        transaction.createdAt.getMonth() + 1,
        transaction.createdAt.getDate()
      );
      
      const monthKey = `${jy}-${jm}`;
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
        jy, jm
      });
    });

    console.log('\nMonthly breakdown:');
    monthlyData.forEach((data, monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);
      const persianMonths = [
        'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
        'مرداد', 'شهریور', 'مهر', 'آبان',
        'آذر', 'دی', 'بهمن', 'اسفند'
      ];
      
      console.log(`${year}/${month} (${persianMonths[month - 1]}): ${data.count} transactions`);
      console.log(`  Income: ${data.income.toLocaleString('fa-IR')}, Expense: ${data.expense.toLocaleString('fa-IR')}`);
      console.log(`  Transactions: ${data.transactions.map(t => `${t.date}(${t.jy}/${t.jm})`).join(', ')}`);
      console.log('');
    });

    console.log('✅ Debug completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugChartDates();
