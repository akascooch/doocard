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

async function minimalMigration() {
  const movaClient = new Client(movaConfig);
  const zapasClient = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to databases...');
    await movaClient.connect();
    await zapasClient.connect();
    console.log('✅ Connected to both databases');

    // Clear zapas database
    console.log('🧹 Clearing zapas database...');
    await zapasClient.query('TRUNCATE TABLE transactions CASCADE');
    await zapasClient.query('TRUNCATE TABLE financial_entries CASCADE');
    await zapasClient.query('TRUNCATE TABLE appointment_services CASCADE');
    await zapasClient.query('TRUNCATE TABLE appointments CASCADE');
    await zapasClient.query('TRUNCATE TABLE customers CASCADE');
    await zapasClient.query('TRUNCATE TABLE barbers CASCADE');
    await zapasClient.query('TRUNCATE TABLE users CASCADE');
    console.log('✅ Zapas database cleared');

    // Migrate users with default values for null fields
    console.log('📊 Migrating users...');
    const users = await movaClient.query('SELECT * FROM users WHERE email IS NOT NULL');
    for (const user of users.rows) {
      await zapasClient.query(`
        INSERT INTO users (email, password, "firstName", "lastName", "phoneNumber", role, "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        user.email,
        user.password,
        user.firstname || 'نام',
        user.lastname || 'نام خانوادگی',
        user.phonenumber || '09123456789',
        user.role || 'CUSTOMER',
        user.isactive !== null ? user.isactive : true,
        user.createdat || new Date(),
        user.updatedat || new Date()
      ]);
    }
    console.log(`   ✅ Users: ${users.rows.length} records migrated`);

    // Migrate barbers with default values
    console.log('📊 Migrating barbers...');
    const barbers = await movaClient.query('SELECT * FROM barbers WHERE email IS NOT NULL');
    for (const barber of barbers.rows) {
      await zapasClient.query(`
        INSERT INTO barbers (email, "firstName", "lastName", "phoneNumber", bio, avatar, "isActive", type, "salaryPercentage", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        barber.email,
        barber.firstname || 'آرایشگر',
        barber.lastname || 'آرایشگر',
        barber.phonenumber || '09123456789',
        barber.bio || null,
        barber.avatar || null,
        barber.isactive !== null ? barber.isactive : true,
        barber.type || 'BARBER',
        barber.salarypercentage || 60,
        barber.createdat || new Date(),
        barber.updatedat || new Date()
      ]);
    }
    console.log(`   ✅ Barbers: ${barbers.rows.length} records migrated`);

    // Migrate customers with default values
    console.log('📊 Migrating customers...');
    const customers = await movaClient.query('SELECT * FROM customers');
    for (const customer of customers.rows) {
      await zapasClient.query(`
        INSERT INTO customers ("firstName", "lastName", "phoneNumber", email, "barberId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        customer.firstname || 'مشتری',
        customer.lastname || 'مشتری',
        customer.phonenumber || '09123456789',
        customer.email,
        customer.barberid,
        customer.createdat || new Date(),
        customer.updatedat || new Date()
      ]);
    }
    console.log(`   ✅ Customers: ${customers.rows.length} records migrated`);

    // Migrate appointments with default values
    console.log('📊 Migrating appointments...');
    const appointments = await movaClient.query('SELECT * FROM appointments WHERE date IS NOT NULL');
    for (const appointment of appointments.rows) {
      await zapasClient.query(`
        INSERT INTO appointments (date, status, "barberId", "customerId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        appointment.date,
        appointment.status || 'PENDING',
        appointment.barberid || 1,
        appointment.customerid || 1,
        appointment.createdat || new Date(),
        appointment.updatedat || new Date()
      ]);
    }
    console.log(`   ✅ Appointments: ${appointments.rows.length} records migrated`);

    // Migrate appointment_services
    console.log('📊 Migrating appointment_services...');
    const appointmentServices = await movaClient.query('SELECT * FROM appointment_services');
    for (const appointmentService of appointmentServices.rows) {
      await zapasClient.query(`
        INSERT INTO appointment_services ("appointmentId", "serviceId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4)
      `, [
        appointmentService.appointmentid,
        appointmentService.serviceid,
        appointmentService.createdat || new Date(),
        appointmentService.updatedat || new Date()
      ]);
    }
    console.log(`   ✅ Appointment Services: ${appointmentServices.rows.length} records migrated`);

    // Migrate transactions
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
        transaction.createdat || new Date(),
        transaction.updatedat || new Date()
      ]);
    }
    console.log(`   ✅ Transactions: ${transactions.rows.length} records migrated`);

    // Migrate financial_entries
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
        entry.createdat || new Date(),
        entry.updatedat || new Date()
      ]);
    }
    console.log(`   ✅ Financial Entries: ${financialEntries.rows.length} records migrated`);

    console.log('🎉 Minimal migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await movaClient.end();
    await zapasClient.end();
  }
}

minimalMigration(); 