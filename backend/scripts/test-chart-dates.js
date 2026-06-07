const { PrismaClient } = require('@prisma/client');
const jalaali = require('jalaali-js');

const prisma = new PrismaClient();

async function testChartDates() {
  try {
    console.log('🧪 Testing chart date calculations...\n');

    // 1. بررسی تراکنش‌های اخیر با تاریخ
    console.log('📊 Recent transactions with dates:');
    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        createdAt: true
      }
    });

    console.log(`Found ${recentTransactions.length} recent transactions:`);
    recentTransactions.forEach((t, i) => {
      const { jy, jm, jd } = jalaali.toJalaali(
        t.createdAt.getFullYear(),
        t.createdAt.getMonth() + 1,
        t.createdAt.getDate()
      );
      
      const sign = t.amount >= 0 ? '+' : '';
      console.log(`${i + 1}. ID: ${t.id} - ${t.category}: ${sign}${t.amount.toLocaleString('fa-IR')}`);
      console.log(`   میلادی: ${t.createdAt.toLocaleDateString('en-US')}`);
      console.log(`   شمسی: ${jy}/${jm}/${jd}`);
      console.log('');
    });

    // 2. تست تبدیل تاریخ‌ها
    console.log('🔄 Testing date conversions:');
    const testDates = [
      new Date('2025-08-15'), // مرداد
      new Date('2025-09-15'), // شهریور
      new Date('2025-10-15'), // مهر
      new Date('2025-11-15'), // آبان
    ];

    testDates.forEach((date, i) => {
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
      
      console.log(`${i + 1}. میلادی: ${date.toLocaleDateString('en-US')}`);
      console.log(`   شمسی: ${jy}/${jm}/${jd} (${persianMonths[jm - 1]})`);
      console.log(`   monthKey: ${jy}-${jm}`);
      console.log('');
    });

    // 3. تست محاسبه ماه‌ها
    console.log('📅 Testing month calculations:');
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5 + 1, 1);
    
    console.log(`Current date: ${now.toLocaleDateString('en-US')}`);
    console.log(`Start date for 5 months: ${startDate.toLocaleDateString('en-US')}`);
    
    // محاسبه ماه‌های شمسی
    for (let i = 0; i < 5; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + 1 + i, 1);
      const { jy, jm } = jalaali.toJalaali(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      
      const persianMonths = [
        'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
        'مرداد', 'شهریور', 'مهر', 'آبان',
        'آذر', 'دی', 'بهمن', 'اسفند'
      ];
      
      console.log(`Month ${i + 1}: ${date.toLocaleDateString('en-US')} -> ${jy}/${jm} (${persianMonths[jm - 1]})`);
    }

    // 4. تست تراکنش‌های ماه‌های مختلف
    console.log('\n💰 Testing transactions by month:');
    const monthlyData = new Map();
    
    recentTransactions.forEach((transaction) => {
      const { jy, jm } = jalaali.toJalaali(
        transaction.createdAt.getFullYear(),
        transaction.createdAt.getMonth() + 1,
        transaction.createdAt.getDate()
      );
      
      const monthKey = `${jy}-${jm}`;
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { income: 0, expense: 0, count: 0 });
      }
      
      const data = monthlyData.get(monthKey);
      if (transaction.amount >= 0) {
        data.income += transaction.amount;
      } else {
        data.expense += Math.abs(transaction.amount);
      }
      data.count++;
    });

    console.log('Monthly summary:');
    monthlyData.forEach((data, monthKey) => {
      const [year, month] = monthKey.split('-').map(Number);
      const persianMonths = [
        'فروردین', 'اردیبهشت', 'خرداد', 'تیر',
        'مرداد', 'شهریور', 'مهر', 'آبان',
        'آذر', 'دی', 'بهمن', 'اسفند'
      ];
      
      console.log(`${year}/${month} (${persianMonths[month - 1]}): ${data.count} transactions`);
      console.log(`  Income: ${data.income.toLocaleString('fa-IR')}, Expense: ${data.expense.toLocaleString('fa-IR')}`);
    });

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testChartDates();
