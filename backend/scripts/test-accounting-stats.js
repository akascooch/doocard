const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function testAccountingStats() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // محاسبه آمار کلی
    console.log('\n📊 Calculating overall accounting stats:');
    
    // محاسبه درآمد کل از تراکنش‌های نوبت‌ها
    const appointments = await client.query(`
      SELECT 
        a.id,
        a.date,
        COUNT(t.id) as transaction_count,
        STRING_AGG(t.amount::text, ', ' ORDER BY t.amount DESC) as amounts_desc,
        SUM(t.amount) as total_amount
      FROM appointments a
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      GROUP BY a.id, a.date
      ORDER BY a.id
    `);

    let totalServiceIncome = 0;
    let totalTipIncome = 0;

    appointments.rows.forEach(appointment => {
      if (appointment.transaction_count > 0) {
        const amounts = appointment.amounts_desc.split(', ').map(Number);
        
        if (amounts.length === 1) {
          totalServiceIncome += amounts[0];
        } else {
          totalServiceIncome += amounts[0]; // بزرگترین مبلغ
          for (let i = 1; i < amounts.length; i++) {
            totalTipIncome += amounts[i];
          }
        }
      }
    });

    const totalIncome = totalServiceIncome + totalTipIncome;

    // محاسبه هزینه‌ها از تراکنش‌های حقوق
    const salaryTransactions = await client.query(`
      SELECT SUM(amount) as total_salary
      FROM transactions
      WHERE category = 'SALARY'
    `);

    const totalExpense = salaryTransactions.rows[0].total_salary || 0;

    // محاسبه آمار ماه جاری
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const currentMonthAppointments = await client.query(`
      SELECT 
        a.id,
        a.date,
        COUNT(t.id) as transaction_count,
        STRING_AGG(t.amount::text, ', ' ORDER BY t.amount DESC) as amounts_desc,
        SUM(t.amount) as total_amount
      FROM appointments a
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      WHERE a.date >= $1
      GROUP BY a.id, a.date
      ORDER BY a.id
    `, [firstDayOfMonth]);

    let monthlyServiceIncome = 0;
    let monthlyTipIncome = 0;

    currentMonthAppointments.rows.forEach(appointment => {
      if (appointment.transaction_count > 0) {
        const amounts = appointment.amounts_desc.split(', ').map(Number);
        
        if (amounts.length === 1) {
          monthlyServiceIncome += amounts[0];
        } else {
          monthlyServiceIncome += amounts[0];
          for (let i = 1; i < amounts.length; i++) {
            monthlyTipIncome += amounts[i];
          }
        }
      }
    });

    const monthlyIncome = monthlyServiceIncome + monthlyTipIncome;

    // محاسبه هزینه‌های ماه جاری
    const monthlySalaryTransactions = await client.query(`
      SELECT SUM(amount) as monthly_salary
      FROM transactions
      WHERE category = 'SALARY' AND "createdAt" >= $1
    `, [firstDayOfMonth]);

    const monthlyExpense = monthlySalaryTransactions.rows[0].monthly_salary || 0;

    console.log('📊 Overall Stats:');
    console.log(`   Total Service Income: ${totalServiceIncome.toLocaleString()} تومان`);
    console.log(`   Total Tip Income: ${totalTipIncome.toLocaleString()} تومان`);
    console.log(`   Total Income: ${totalIncome.toLocaleString()} تومان`);
    console.log(`   Total Expense: ${totalExpense.toLocaleString()} تومان`);
    console.log(`   Balance: ${(totalIncome - totalExpense).toLocaleString()} تومان`);
    
    console.log('\n📊 Current Month Stats:');
    console.log(`   Monthly Service Income: ${monthlyServiceIncome.toLocaleString()} تومان`);
    console.log(`   Monthly Tip Income: ${monthlyTipIncome.toLocaleString()} تومان`);
    console.log(`   Monthly Income: ${monthlyIncome.toLocaleString()} تومان`);
    console.log(`   Monthly Expense: ${monthlyExpense.toLocaleString()} تومان`);
    console.log(`   Monthly Balance: ${(monthlyIncome - monthlyExpense).toLocaleString()} تومان`);

    // تست نمودار
    console.log('\n📊 Testing chart data:');
    const chartData = await client.query(`
      SELECT 
        DATE_TRUNC('month', a.date) as month,
        COUNT(DISTINCT a.id) as appointment_count,
        SUM(t.amount) as total_income
      FROM appointments a
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      WHERE a.date >= $1
      GROUP BY DATE_TRUNC('month', a.date)
      ORDER BY month
    `, [new Date(now.getFullYear(), now.getMonth() - 5, 1)]);

    console.log('   Chart data (last 6 months):');
    chartData.rows.forEach(row => {
      console.log(`   ${row.month.toISOString().slice(0, 7)}: ${row.appointment_count} appointments, ${row.total_income?.toLocaleString() || 0} تومان`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testAccountingStats(); 