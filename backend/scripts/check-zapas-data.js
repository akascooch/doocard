const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function checkZapasData() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // Check appointments and their amounts
    console.log('\n📊 Appointments with amounts:');
    const appointments = await client.query(`
      SELECT 
        a.id,
        a.date,
        a.status,
        c."firstName" as customer_name,
        b."firstName" as barber_name,
        COALESCE(SUM(t.amount), 0) as total_amount
      FROM appointments a
      LEFT JOIN customers c ON a."customerId" = c.id
      LEFT JOIN barbers b ON a."barberId" = b.id
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      GROUP BY a.id, a.date, a.status, c."firstName", b."firstName"
      ORDER BY a.id
      LIMIT 10
    `);
    
    appointments.rows.forEach(row => {
      console.log(`   Appointment ${row.id}: ${row.customer_name} -> ${row.barber_name} | Amount: ${row.total_amount} | Status: ${row.status}`);
    });

    // Check transactions
    console.log('\n📊 Transactions:');
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

    // Check barber balances
    console.log('\n📊 Barber balances:');
    const barberBalances = await client.query(`
      SELECT 
        b.id,
        b."firstName",
        b."lastName",
        COUNT(a.id) as total_appointments,
        COALESCE(SUM(t.amount), 0) as total_earnings,
        COALESCE(SUM(s.amount), 0) as total_salaries
      FROM barbers b
      LEFT JOIN appointments a ON b.id = a."barberId"
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      LEFT JOIN salaries s ON b.id = s."barberId"
      GROUP BY b.id, b."firstName", b."lastName"
      ORDER BY b.id
    `);
    
    barberBalances.rows.forEach(row => {
      const balance = row.total_earnings - row.total_salaries;
      console.log(`   ${row.firstName} ${row.lastName}: ${row.total_appointments} appointments | Earnings: ${row.total_earnings} | Salaries: ${row.total_salaries} | Balance: ${balance}`);
    });

    // Check appointment_services
    console.log('\n📊 Appointment services:');
    const appointmentServices = await client.query(`
      SELECT 
        as2.id,
        as2."appointmentId",
        as2."serviceId",
        as2.price,
        s.name as service_name
      FROM appointment_services as2
      LEFT JOIN services s ON as2."serviceId" = s.id
      ORDER BY as2."appointmentId"
      LIMIT 10
    `);
    
    appointmentServices.rows.forEach(row => {
      console.log(`   Appointment ${row.appointmentId}: ${row.service_name} | Price: ${row.price}`);
    });

    // Check if there are any issues with the data
    console.log('\n🔍 Data integrity check:');
    
    // Check for appointments without transactions
    const appointmentsWithoutTransactions = await client.query(`
      SELECT COUNT(*) as count
      FROM appointments a
      LEFT JOIN transactions t ON a.id = t."appointmentId"
      WHERE t.id IS NULL
    `);
    console.log(`   Appointments without transactions: ${appointmentsWithoutTransactions.rows[0].count}`);

    // Check for transactions without appointments
    const transactionsWithoutAppointments = await client.query(`
      SELECT COUNT(*) as count
      FROM transactions t
      LEFT JOIN appointments a ON t."appointmentId" = a.id
      WHERE a.id IS NULL
    `);
    console.log(`   Transactions without appointments: ${transactionsWithoutAppointments.rows[0].count}`);

    // Check total amounts
    const totalAmounts = await client.query(`
      SELECT 
        COUNT(DISTINCT a.id) as total_appointments,
        COUNT(t.id) as total_transactions,
        COALESCE(SUM(t.amount), 0) as total_amount
      FROM appointments a
      LEFT JOIN transactions t ON a.id = t."appointmentId"
    `);
    
    const totals = totalAmounts.rows[0];
    console.log(`   Total appointments: ${totals.total_appointments}`);
    console.log(`   Total transactions: ${totals.total_transactions}`);
    console.log(`   Total amount: ${totals.total_amount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkZapasData(); 