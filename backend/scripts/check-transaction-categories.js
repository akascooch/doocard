const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function checkTransactionCategories() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // بررسی enum values
    console.log('\n📊 Checking TransactionCategory enum values:');
    const enumValues = await client.query(`
      SELECT unnest(enum_range(NULL::"TransactionCategory")) as category
    `);
    
    console.log('Available categories:');
    enumValues.rows.forEach(row => {
      console.log(`   - ${row.category}`);
    });

    // بررسی تراکنش‌های موجود
    console.log('\n📊 Checking existing transactions:');
    const transactions = await client.query(`
      SELECT DISTINCT category, COUNT(*) as count
      FROM transactions
      GROUP BY category
      ORDER BY category
    `);
    
    transactions.rows.forEach(row => {
      console.log(`   ${row.category}: ${row.count} transactions`);
    });

    // بررسی چند تراکنش نمونه
    console.log('\n📊 Sample transactions:');
    const sampleTransactions = await client.query(`
      SELECT id, "appointmentId", amount, status, category, "paymentMethod"
      FROM transactions
      ORDER BY id
      LIMIT 5
    `);
    
    sampleTransactions.rows.forEach(row => {
      console.log(`   Transaction ${row.id}: Appointment ${row.appointmentId} | Amount: ${row.amount} | Category: ${row.category} | Status: ${row.status}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkTransactionCategories(); 