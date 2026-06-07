const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function testAmounts() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // تست محاسبه مبالغ نوبت‌ها
    console.log('\n📊 Testing appointment amounts:');
    const appointmentsWithAmounts = await client.query(`
      SELECT 
        a.id,
        a.date,
        a.status,
        c."firstName" as customer_name,
        b."firstName" as barber_name,
        COALESCE(SUM(CASE WHEN t.category = 'SERVICE_PAYMENT' THEN t.amount ELSE 0 END), 0) as service_amount,
        COALESCE(SUM(t.amount), 0) as total_amount
      FROM appointments a
      LEFT JOIN customers c ON a."customerId" = c.id
      LEFT JOIN barbers b ON a."barberId" = b.id
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      GROUP BY a.id, a.date, a.status, c."firstName", b."firstName"
      ORDER BY a.id
      LIMIT 10
    `);
    
    appointmentsWithAmounts.rows.forEach(row => {
      console.log(`   Appointment ${row.id}: ${row.customer_name} -> ${row.barber_name} | Service: ${row.service_amount} | Total: ${row.total_amount} | Status: ${row.status}`);
    });

    // تست محاسبه موجودی آرایشگران
    console.log('\n📊 Testing barber balances:');
    const barberBalances = await client.query(`
      SELECT 
        b.id,
        b."firstName",
        b."lastName",
        COUNT(a.id) as total_appointments,
        COALESCE(SUM(CASE WHEN t.category = 'SERVICE_PAYMENT' THEN t.amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN t.category = 'SALARY' THEN t.amount ELSE 0 END), 0) as total_salaries,
        COALESCE(SUM(CASE WHEN t.category = 'SERVICE_PAYMENT' THEN t.amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN t.category = 'SALARY' THEN t.amount ELSE 0 END), 0) as balance
      FROM barbers b
      LEFT JOIN appointments a ON b.id = a."barberId"
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      GROUP BY b.id, b."firstName", b."lastName"
      ORDER BY b.id
    `);
    
    barberBalances.rows.forEach(row => {
      console.log(`   ${row.firstName} ${row.lastName}: ${row.total_appointments} appointments | Income: ${row.total_income} | Salaries: ${row.total_salaries} | Balance: ${row.balance}`);
    });

    // تست تراکنش‌ها
    console.log('\n📊 Testing transactions:');
    const transactions = await client.query(`
      SELECT 
        t.id,
        t."appointmentId",
        t.amount,
        t.status,
        t.category,
        t."paymentMethod"
      FROM transactions t
      ORDER BY t.id
      LIMIT 10
    `);
    
    transactions.rows.forEach(row => {
      console.log(`   Transaction ${row.id}: Appointment ${row.appointmentId} | Amount: ${row.amount} | Status: ${row.status} | Category: ${row.category}`);
    });

    // تست آمار کلی
    console.log('\n📊 Overall statistics:');
    const stats = await client.query(`
      SELECT 
        COUNT(DISTINCT a.id) as total_appointments,
        COUNT(t.id) as total_transactions,
        COALESCE(SUM(CASE WHEN t.category = 'SERVICE_PAYMENT' THEN t.amount ELSE 0 END), 0) as total_service_payments,
        COALESCE(SUM(CASE WHEN t.category = 'SALARY' THEN t.amount ELSE 0 END), 0) as total_salaries,
        COALESCE(SUM(t.amount), 0) as total_amount
      FROM appointments a
      LEFT JOIN transactions t ON a.id = t."appointmentId"
    `);
    
    const stat = stats.rows[0];
    console.log(`   Total appointments: ${stat.total_appointments}`);
    console.log(`   Total transactions: ${stat.total_transactions}`);
    console.log(`   Total service payments: ${stat.total_service_payments}`);
    console.log(`   Total salaries: ${stat.total_salaries}`);
    console.log(`   Total amount: ${stat.total_amount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

testAmounts(); 