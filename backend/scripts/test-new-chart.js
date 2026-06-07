const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNewChart() {
  try {
    console.log('🧪 Testing new chart logic...\n');

    // 1. پیدا کردن اولین تراکنش
    console.log('🔍 Finding first transaction...');
    const firstTransaction = await prisma.transaction.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { 
        id: true,
        amount: true,
        category: true,
        createdAt: true 
      }
    });

    if (firstTransaction) {
      const monthIndex = firstTransaction.createdAt.getMonth();
      const year = firstTransaction.createdAt.getFullYear();
      const day = firstTransaction.createdAt.getDate();
      
      console.log('✅ First transaction found:');
      console.log(`   ID: ${firstTransaction.id}`);
      console.log(`   Amount: ${firstTransaction.amount.toLocaleString('fa-IR')}`);
      console.log(`   Category: ${firstTransaction.category}`);
      console.log(`   Date: ${firstTransaction.createdAt.toISOString()}`);
      console.log(`   Month: ${monthIndex + 1} (${monthIndex})`);
      console.log(`   Year: ${year}`);
      console.log(`   Day: ${day}`);
      
      // تبدیل به ماه فارسی
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
      
      console.log(`   Persian Month: ${persianMonthName} (Index: ${persianMonthIndex})`);
      console.log(`   monthKey: ${year}-${persianMonthIndex}`);
      console.log('');
    } else {
      console.log('❌ No transactions found!');
      return;
    }

    // 2. شبیه‌سازی منطق جدید نمودار
    console.log('📊 Simulating new chart logic...');
    
    // پیدا کردن تمام تراکنش‌ها
    const allTransactions = await prisma.transaction.findMany({
      select: {
        amount: true,
        createdAt: true,
        category: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Total transactions: ${allTransactions.length}`);

    const monthlyData = new Map();
    
    // محاسبه درآمد و هزینه برای هر ماه
    allTransactions.forEach((transaction, index) => {
      const monthIndex = transaction.createdAt.getMonth();
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
      
      // بررسی اینکه آیا این تراکنش هزینه است یا درآمد
      const isExpense = transaction.amount < 0 || 
                       transaction.category === 'SALARY' ||
                       transaction.category === 'UTILITY' ||
                       transaction.category === 'RENT' ||
                       transaction.category === 'SUPPLIES' ||
                       transaction.category === 'OTHER';
      
      if (isExpense) {
        data.expense += Math.abs(transaction.amount);
      } else {
        data.income += transaction.amount;
      }
      
      data.count++;
      data.transactions.push({
        id: index,
        amount: transaction.amount,
        date: transaction.createdAt.toISOString(),
        persianMonth: persianMonthName,
        persianMonthIndex,
        originalMonth: monthIndex + 1
      });
    });

    // 3. شبیه‌سازی اضافه کردن ماه‌های خالی
    console.log('\n📈 Simulating month filling logic...');
    
    const chartData = Array.from(monthlyData.entries())
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-').map(Number);
        
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
        
        return {
          month: persianMonthName,
          income: data.income,
          expense: data.expense,
          year,
          monthIndex: month,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.monthIndex - b.monthIndex;
      });

    // اضافه کردن ماه‌های خالی
    const finalChartData = [];
    if (chartData.length > 0) {
      const firstYear = chartData[0].year;
      const firstMonth = chartData[0].monthIndex;
      const lastYear = chartData[chartData.length - 1].year;
      const lastMonth = chartData[chartData.length - 1].monthIndex;
      
      let currentYear = firstYear;
      let currentMonth = firstMonth;
      
      while (currentYear < lastYear || (currentYear === lastYear && currentMonth <= lastMonth)) {
        const existingMonth = chartData.find(item => item.year === currentYear && item.monthIndex === currentMonth);
        
        if (existingMonth) {
          finalChartData.push(existingMonth);
        } else {
          // ماه خالی اضافه کن
          let persianMonthName;
          switch (currentMonth) {
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
          
          finalChartData.push({
            month: persianMonthName,
            income: 0,
            expense: 0,
            year: currentYear,
            monthIndex: currentMonth,
          });
        }
        
        // به ماه بعدی برو
        currentMonth++;
        if (currentMonth > 12) {
          currentMonth = 1;
          currentYear++;
        }
      }
    } else {
      finalChartData.push(...chartData);
    }

    // 4. نمایش نتیجه نهایی
    console.log('\n📊 Final chart data with filled months:');
    finalChartData.forEach((item, index) => {
      console.log(`${index + 1}. ${item.month} (${item.year}):`);
      console.log(`   Income: ${item.income.toLocaleString('fa-IR')}`);
      console.log(`   Expense: ${item.expense.toLocaleString('fa-IR')}`);
      console.log(`   Month Index: ${item.monthIndex}`);
      console.log('');
    });

    console.log('✅ New chart logic test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testNewChart();
