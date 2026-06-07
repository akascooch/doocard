const { Client } = require('pg');

// Configuration
const movaConfig = {
  host: 'localhost',
  port: 5433,
  database: 'mova',
  user: 'postgres',
  password: 'Lord7know$'
};

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function migrateEssentialData() {
  const movaClient = new Client(movaConfig);
  const zapasClient = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to databases...');
    await movaClient.connect();
    await zapasClient.connect();
    console.log('✅ Connected to both databases');

    // Clear essential tables in zapas
    console.log('🧹 Clearing essential tables in zapas...');
    await zapasClient.query('TRUNCATE TABLE transactions CASCADE');
    await zapasClient.query('TRUNCATE TABLE financial_entries CASCADE');
    await zapasClient.query('TRUNCATE TABLE appointment_services CASCADE');
    await zapasClient.query('TRUNCATE TABLE appointments CASCADE');
    await zapasClient.query('TRUNCATE TABLE customers CASCADE');
    await zapasClient.query('TRUNCATE TABLE barbers CASCADE');
    await zapasClient.query('TRUNCATE TABLE users CASCADE');
    console.log('✅ Essential tables cleared');

    // Migrate users (simple mapping)
    console.log('📊 Migrating users...');
    const users = await movaClient.query('SELECT * FROM users');
    for (const user of users.rows) {
      await zapasClient.query(`
        INSERT INTO users (email, password, "firstName", "lastName", "phoneNumber", role, "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        user.email,
        user.password,
        user.firstname,
        user.lastname,
        user.phonenumber,
        user.role,
        user.isactive,
        user.createdat,
        user.updatedat
      ]);
    }
    console.log(`   ✅ Users: ${users.rows.length} records migrated`);

    // Migrate barbers (simple mapping)
    console.log('📊 Migrating barbers...');
    const barbers = await movaClient.query('SELECT * FROM barbers');
    for (const barber of barbers.rows) {
      await zapasClient.query(`
        INSERT INTO barbers (email, "firstName", "lastName", "phoneNumber", bio, avatar, "isActive", type, "salaryPercentage", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        barber.email,
        barber.firstname,
        barber.lastname,
        barber.phonenumber,
        barber.bio,
        barber.avatar,
        barber.isactive,
        barber.type,
        barber.salarypercentage || 60, // Default to 60%
        barber.createdat,
        barber.updatedat
      ]);
    }
    console.log(`   ✅ Barbers: ${barbers.rows.length} records migrated`);

    // Migrate customers (simple mapping)
    console.log('📊 Migrating customers...');
    const customers = await movaClient.query('SELECT * FROM customers');
    for (const customer of customers.rows) {
      await zapasClient.query(`
        INSERT INTO customers ("firstName", "lastName", "phoneNumber", email, "barberId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        customer.firstname,
        customer.lastname,
        customer.phonenumber,
        customer.email,
        customer.barberid,
        customer.createdat,
        customer.updatedat
      ]);
    }
    console.log(`   ✅ Customers: ${customers.rows.length} records migrated`);

    // Migrate appointments (simple mapping)
    console.log('📊 Migrating appointments...');
    const appointments = await movaClient.query('SELECT * FROM appointments');
    for (const appointment of appointments.rows) {
      await zapasClient.query(`
        INSERT INTO appointments (date, status, "barberId", "customerId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        appointment.date,
        appointment.status,
        appointment.barberid,
        appointment.customerid,
        appointment.createdat,
        appointment.updatedat
      ]);
    }
    console.log(`   ✅ Appointments: ${appointments.rows.length} records migrated`);

    // Migrate appointment_services (simple mapping)
    console.log('📊 Migrating appointment_services...');
    const appointmentServices = await movaClient.query('SELECT * FROM appointment_services');
    for (const appointmentService of appointmentServices.rows) {
      await zapasClient.query(`
        INSERT INTO appointment_services ("appointmentId", "serviceId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4)
      `, [
        appointmentService.appointmentid,
        appointmentService.serviceid,
        appointmentService.createdat,
        appointmentService.updatedat
      ]);
    }
    console.log(`   ✅ Appointment Services: ${appointmentServices.rows.length} records migrated`);

    // Migrate transactions (simple mapping)
    console.log('📊 Migrating transactions...');
    const transactions = await movaClient.query('SELECT * FROM transactions');
    for (const transaction of transactions.rows) {
      await zapasClient.query(`
        INSERT INTO transactions (amount, type, "appointmentId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5)
      `, [
        transaction.amount,
        transaction.type,
        transaction.appointmentid,
        transaction.createdat,
        transaction.updatedat
      ]);
    }
    console.log(`   ✅ Transactions: ${transactions.rows.length} records migrated`);

    // Migrate financial_entries (simple mapping)
    console.log('📊 Migrating financial_entries...');
    const financialEntries = await movaClient.query('SELECT * FROM "FinancialEntry"');
    for (const entry of financialEntries.rows) {
      await zapasClient.query(`
        INSERT INTO financial_entries (amount, type, date, description, "categoryId", reference, "paymentMethod", "createdBy", "attachmentUrl", "bankAccountId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [
        entry.amount,
        entry.type,
        entry.date,
        entry.description,
        entry.categoryid,
        entry.reference,
        entry.paymentmethod,
        entry.createdby,
        entry.attachmenturl,
        entry.bankaccountid,
        entry.createdat,
        entry.updatedat
      ]);
    }
    console.log(`   ✅ Financial Entries: ${financialEntries.rows.length} records migrated`);

    console.log('🎉 Essential data migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await movaClient.end();
    await zapasClient.end();
  }
}

migrateEssentialData(); 