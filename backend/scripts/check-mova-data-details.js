const { Client } = require('pg');

const movaConfig = {
  host: 'localhost',
  port: 5433,
  database: 'mova',
  user: 'postgres',
  password: 'Lord7know$'
};

async function checkMovaDataDetails() {
  const client = new Client(movaConfig);

  try {
    console.log('🔍 Connecting to mova database...');
    await client.connect();
    console.log('✅ Connected to mova database');

    // Check appointments
    console.log('\n📊 Appointments in Mova:');
    const appointments = await client.query('SELECT id, "customerId", "barberId", date FROM appointments ORDER BY id');
    console.log(`   Total appointments: ${appointments.rows.length}`);
    appointments.rows.forEach(row => {
      console.log(`   ID: ${row.id}, Customer: ${row.customerId}, Barber: ${row.barberId}, Date: ${row.date}`);
    });

    // Check barbers
    console.log('\n📊 Barbers in Mova:');
    const barbers = await client.query('SELECT id, "firstName", "lastName", email FROM barbers ORDER BY id');
    console.log(`   Total barbers: ${barbers.rows.length}`);
    barbers.rows.forEach(row => {
      console.log(`   ID: ${row.id}, Name: ${row.firstName} ${row.lastName}, Email: ${row.email}`);
    });

    // Check customers
    console.log('\n📊 Customers in Mova:');
    const customers = await client.query('SELECT id, "firstName", "lastName", email FROM customers ORDER BY id');
    console.log(`   Total customers: ${customers.rows.length}`);
    customers.rows.forEach(row => {
      console.log(`   ID: ${row.id}, Name: ${row.firstName} ${row.lastName}, Email: ${row.email}`);
    });

    // Check transactions and their appointment references
    console.log('\n📊 Transactions in Mova:');
    const transactions = await client.query('SELECT id, "appointmentId", amount FROM transactions ORDER BY id LIMIT 10');
    console.log(`   Total transactions: ${transactions.rows.length}`);
    transactions.rows.forEach(row => {
      console.log(`   ID: ${row.id}, Appointment: ${row.appointmentId}, Amount: ${row.amount}`);
    });

    // Check which appointment IDs are referenced in transactions
    const referencedAppointments = await client.query(`
      SELECT DISTINCT "appointmentId" 
      FROM transactions 
      WHERE "appointmentId" IS NOT NULL 
      ORDER BY "appointmentId"
    `);
    console.log(`\n   Referenced appointment IDs in transactions: ${referencedAppointments.rows.map(r => r.appointmentId).join(', ')}`);

    // Check which barber IDs are referenced in salaries
    const referencedBarbers = await client.query(`
      SELECT DISTINCT "barberId" 
      FROM salaries 
      WHERE "barberId" IS NOT NULL 
      ORDER BY "barberId"
    `);
    console.log(`\n   Referenced barber IDs in salaries: ${referencedBarbers.rows.map(r => r.barberId).join(', ')}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkMovaDataDetails(); 