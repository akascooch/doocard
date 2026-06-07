const { Client } = require('pg');
const fs = require('fs');

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

async function migrateData() {
  const movaClient = new Client(movaConfig);
  const zapasClient = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to databases...');
    await movaClient.connect();
    await zapasClient.connect();
    console.log('✅ Connected to both databases');

    // Clear zapas database
    console.log('🧹 Clearing zapas database...');
    await zapasClient.query('TRUNCATE TABLE "Transaction" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "FinancialEntry" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "BarberWithdrawalRequest" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "TipTransaction" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Salary" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "AppointmentService" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Appointment" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Customer" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Barber" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Service" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "User" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "FinancialCategory" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "BankAccount" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Setting" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Permission" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "SmsLog" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "SmsSettings" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "SmsTemplate" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Profile" CASCADE');
    console.log('✅ Zapas database cleared');

    // Reset sequences
    console.log('🔄 Resetting sequences...');
    const sequences = [
      'User_id_seq', 'Profile_id_seq', 'Barber_id_seq', 'Service_id_seq',
      'Customer_id_seq', 'Appointment_id_seq', 'AppointmentService_id_seq',
      'Transaction_id_seq', 'FinancialCategory_id_seq', 'FinancialEntry_id_seq',
      'BankAccount_id_seq', 'Salary_id_seq', 'TipTransaction_id_seq',
      'BarberWithdrawalRequest_id_seq', 'Setting_id_seq', 'Permission_id_seq',
      'SmsLog_id_seq', 'SmsSettings_id_seq', 'SmsTemplate_id_seq'
    ];

    for (const seq of sequences) {
      await zapasClient.query(`ALTER SEQUENCE "${seq}" RESTART WITH 1`);
    }
    console.log('✅ Sequences reset');

    // Migrate data table by table
    const tables = [
      { name: 'User', fields: 'email, password, "firstName", "lastName", "phoneNumber", role, "isActive", "createdAt", "updatedAt"' },
      { name: 'Service', fields: 'name, description, price, duration, "isActive", "createdAt", "updatedAt"' },
      { name: 'FinancialCategory', fields: 'name, description, type, "createdAt", "updatedAt"' },
      { name: 'BankAccount', fields: 'name, "cardNumber", "createdAt", "updatedAt"' },
      { name: 'Barber', fields: 'email, "firstName", "lastName", "phoneNumber", bio, avatar, "isActive", type, "salaryPercentage", "createdAt", "updatedAt"' },
      { name: 'Customer', fields: '"firstName", "lastName", "phoneNumber", email, "barberId", "createdAt", "updatedAt"' },
      { name: 'Appointment', fields: 'date, time, status, "totalAmount", "tipAmount", "barberId", "customerId", "createdAt", "updatedAt"' },
      { name: 'AppointmentService', fields: '"appointmentId", "serviceId", "createdAt", "updatedAt"' },
      { name: 'FinancialEntry', fields: 'amount, type, date, description, "categoryId", reference, "paymentMethod", "createdBy", "attachmentUrl", "bankAccountId", "createdAt", "updatedAt"' },
      { name: 'Transaction', fields: 'amount, type, "appointmentId", "createdAt", "updatedAt"' },
      { name: 'Salary', fields: 'amount, "barberId", "createdAt", "updatedAt"' },
      { name: 'TipTransaction', fields: 'amount, "appointmentId", "createdAt", "updatedAt"' },
      { name: 'BarberWithdrawalRequest', fields: '"barberId", amount, description, status, "approvedBy", "createdAt", "updatedAt"' },
      { name: 'Setting', fields: 'key, value, "createdAt", "updatedAt"' },
      { name: 'Permission', fields: 'name, description, "createdAt", "updatedAt"' },
      { name: 'SmsLog', fields: 'phone, message, status, "createdAt", "updatedAt"' },
      { name: 'SmsSettings', fields: 'provider, "apiKey", "apiSecret", "createdAt", "updatedAt"' },
      { name: 'SmsTemplate', fields: 'name, content, "createdAt", "updatedAt"' },
      { name: 'Profile', fields: '"userId", avatar, bio, "createdAt", "updatedAt"' }
    ];

    for (const table of tables) {
      console.log(`📊 Migrating ${table.name}...`);
      try {
        const result = await movaClient.query(`SELECT ${table.fields} FROM "${table.name}"`);
        if (result.rows.length > 0) {
          for (const row of result.rows) {
            const fields = table.fields.split(', ').map(f => f.replace(/"/g, ''));
            const values = fields.map(field => {
              const value = row[field];
              return value === null ? 'NULL' : `'${String(value).replace(/'/g, "''")}'`;
            });
            
            await zapasClient.query(`INSERT INTO "${table.name}" (${table.fields}) VALUES (${values.join(', ')})`);
          }
          console.log(`   ✅ ${table.name}: ${result.rows.length} records migrated`);
        } else {
          console.log(`   ⚠️  ${table.name}: No records found`);
        }
      } catch (error) {
        console.log(`   ❌ ${table.name}: Error - ${error.message}`);
      }
    }

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await movaClient.end();
    await zapasClient.end();
  }
}

migrateData(); 