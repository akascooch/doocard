const { Client } = require('pg');

const movaConfig = {
  host: 'localhost',
  port: 5433,
  database: 'mova',
  user: 'postgres',
  password: 'Lord7know$'
};

async function checkMovaData() {
  const client = new Client(movaConfig);

  try {
    console.log('🔍 Connecting to mova database...');
    await client.connect();
    console.log('✅ Connected to mova database');

    // Check users data
    console.log('\n📊 Users data sample:');
    const users = await client.query('SELECT * FROM users LIMIT 3');
    users.rows.forEach((user, index) => {
      console.log(`User ${index + 1}:`, {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        phonenumber: user.phonenumber,
        role: user.role,
        isactive: user.isactive
      });
    });

    // Check barbers data
    console.log('\n📊 Barbers data sample:');
    const barbers = await client.query('SELECT * FROM barbers LIMIT 3');
    barbers.rows.forEach((barber, index) => {
      console.log(`Barber ${index + 1}:`, {
        id: barber.id,
        email: barber.email,
        firstname: barber.firstname,
        lastname: barber.lastname,
        phonenumber: barber.phonenumber,
        type: barber.type,
        salarypercentage: barber.salarypercentage
      });
    });

    // Check customers data
    console.log('\n📊 Customers data sample:');
    const customers = await client.query('SELECT * FROM customers LIMIT 3');
    customers.rows.forEach((customer, index) => {
      console.log(`Customer ${index + 1}:`, {
        id: customer.id,
        firstname: customer.firstname,
        lastname: customer.lastname,
        phonenumber: customer.phonenumber,
        email: customer.email,
        barberid: customer.barberid
      });
    });

    // Check appointments data
    console.log('\n📊 Appointments data sample:');
    const appointments = await client.query('SELECT * FROM appointments LIMIT 3');
    appointments.rows.forEach((appointment, index) => {
      console.log(`Appointment ${index + 1}:`, {
        id: appointment.id,
        date: appointment.date,
        status: appointment.status,
        barberid: appointment.barberid,
        customerid: appointment.customerid
      });
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkMovaData(); 