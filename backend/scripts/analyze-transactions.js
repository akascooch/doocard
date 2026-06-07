const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function analyzeTransactions() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // بررسی تراکنش‌های یک نوبت خاص
    console.log('\n📊 Analyzing transactions for appointment 57:');
    const appointmentTransactions = await client.query(`
      SELECT 
        t.id,
        t."appointmentId",
        t.amount,
        t.status,
        t.category,
        t."paymentMethod",
        t."createdAt",
        t."updatedAt"
      FROM transactions t
      WHERE t."appointmentId" = 57
      ORDER BY t.id
    `);
    
    appointmentTransactions.rows.forEach(row => {
      console.log(`   Transaction ${row.id}: Amount: ${row.amount} | Category: ${row.category} | Payment: ${row.paymentMethod} | Created: ${row.createdAt}`);
    });

    // بررسی الگوی تراکنش‌ها
    console.log('\n📊 Transaction patterns:');
    const patterns = await client.query(`
      SELECT 
        "appointmentId",
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount,
        STRING_AGG(amount::text, ', ' ORDER BY amount) as amounts,
        STRING_AGG("paymentMethod", ', ' ORDER BY amount) as payment_methods
      FROM transactions
      GROUP BY "appointmentId"
      ORDER BY "appointmentId"
      LIMIT 10
    `);
    
    patterns.rows.forEach(row => {
      console.log(`   Appointment ${row.appointmentId}: ${row.transaction_count} transactions | Total: ${row.total_amount} | Amounts: ${row.amounts} | Methods: ${row.payment_methods}`);
    });

    // بررسی مبالغ مختلف در یک نوبت
    console.log('\n📊 Multiple transactions per appointment analysis:');
    const multipleTransactions = await client.query(`
      SELECT 
        "appointmentId",
        COUNT(*) as transaction_count
      FROM transactions
      GROUP BY "appointmentId"
      HAVING COUNT(*) > 1
      ORDER BY transaction_count DESC
      LIMIT 5
    `);
    
    multipleTransactions.rows.forEach(row => {
      console.log(`   Appointment ${row.appointmentId}: ${row.transaction_count} transactions`);
    });

    // بررسی تراکنش‌های با مبالغ کوچک (احتمالاً تیپ)
    console.log('\n📊 Small amount transactions (potential tips):');
    const smallTransactions = await client.query(`
      SELECT 
        t.id,
        t."appointmentId",
        t.amount,
        t."paymentMethod",
        a.date as appointment_date
      FROM transactions t
      LEFT JOIN appointments a ON t."appointmentId" = a.id
      WHERE t.amount <= 500000
      ORDER BY t.amount DESC
      LIMIT 10
    `);
    
    smallTransactions.rows.forEach(row => {
      console.log(`   Transaction ${row.id}: Appointment ${row.appointmentId} | Amount: ${row.amount} | Payment: ${row.paymentMethod} | Date: ${row.appointment_date}`);
    });

    // بررسی تراکنش‌های با مبالغ بزرگ (احتمالاً خدمات)
    console.log('\n📊 Large amount transactions (likely services):');
    const largeTransactions = await client.query(`
      SELECT 
        t.id,
        t."appointmentId",
        t.amount,
        t."paymentMethod",
        a.date as appointment_date
      FROM transactions t
      LEFT JOIN appointments a ON t."appointmentId" = a.id
      WHERE t.amount > 500000
      ORDER BY t.amount DESC
      LIMIT 10
    `);
    
    largeTransactions.rows.forEach(row => {
      console.log(`   Transaction ${row.id}: Appointment ${row.appointmentId} | Amount: ${row.amount} | Payment: ${row.paymentMethod} | Date: ${row.appointment_date}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

analyzeTransactions(); 