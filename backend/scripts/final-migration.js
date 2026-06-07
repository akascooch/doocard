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

async function migrateData() {
  const movaClient = new Client(movaConfig);
  const zapasClient = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to databases...');
    await movaClient.connect();
    await zapasClient.connect();
    console.log('✅ Connected to both databases');

    // Clear zapas database (using correct table names)
    console.log('🧹 Clearing zapas database...');
    await zapasClient.query('TRUNCATE TABLE transactions CASCADE');
    await zapasClient.query('TRUNCATE TABLE financial_entries CASCADE');
    await zapasClient.query('TRUNCATE TABLE "BarberWithdrawalRequest" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "TipTransaction" CASCADE');
    await zapasClient.query('TRUNCATE TABLE salaries CASCADE');
    await zapasClient.query('TRUNCATE TABLE appointment_services CASCADE');
    await zapasClient.query('TRUNCATE TABLE appointments CASCADE');
    await zapasClient.query('TRUNCATE TABLE customers CASCADE');
    await zapasClient.query('TRUNCATE TABLE barbers CASCADE');
    await zapasClient.query('TRUNCATE TABLE services CASCADE');
    await zapasClient.query('TRUNCATE TABLE users CASCADE');
    await zapasClient.query('TRUNCATE TABLE financial_categories CASCADE');
    await zapasClient.query('TRUNCATE TABLE bank_accounts CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Setting" CASCADE');
    await zapasClient.query('TRUNCATE TABLE "Permission" CASCADE');
    await zapasClient.query('TRUNCATE TABLE sms_logs CASCADE');
    await zapasClient.query('TRUNCATE TABLE sms_settings CASCADE');
    await zapasClient.query('TRUNCATE TABLE sms_templates CASCADE');
    await zapasClient.query('TRUNCATE TABLE profiles CASCADE');
    console.log('✅ Zapas database cleared');

    // Migrate data table by table
    const tables = [
      { 
        name: 'users', 
        fields: 'email, password, "firstName", "lastName", "phoneNumber", role, "isActive", "createdAt", "updatedAt"',
        sourceName: 'users'
      },
      { 
        name: 'services', 
        fields: 'name, description, price, duration, "isActive", "createdAt", "updatedAt"',
        sourceName: 'services'
      },
      { 
        name: 'financial_categories', 
        fields: 'name, description, type, "createdAt", "updatedAt"',
        sourceName: 'financial_categories'
      },
      { 
        name: 'bank_accounts', 
        fields: 'name, "cardNumber", "createdAt", "updatedAt"',
        sourceName: 'bank_accounts'
      },
      { 
        name: 'barbers', 
        fields: 'email, "firstName", "lastName", "phoneNumber", bio, avatar, "isActive", type, "salaryPercentage", "createdAt", "updatedAt"',
        sourceName: 'barbers'
      },
      { 
        name: 'customers', 
        fields: '"firstName", "lastName", "phoneNumber", email, "barberId", "createdAt", "updatedAt"',
        sourceName: 'customers'
      },
      { 
        name: 'appointments', 
        fields: 'date, time, status, "totalAmount", "tipAmount", "barberId", "customerId", "createdAt", "updatedAt"',
        sourceName: 'appointments'
      },
      { 
        name: 'appointment_services', 
        fields: '"appointmentId", "serviceId", "createdAt", "updatedAt"',
        sourceName: 'appointment_services'
      },
      { 
        name: 'financial_entries', 
        fields: 'amount, type, date, description, "categoryId", reference, "paymentMethod", "createdBy", "attachmentUrl", "bankAccountId", "createdAt", "updatedAt"',
        sourceName: 'FinancialEntry'
      },
      { 
        name: 'transactions', 
        fields: 'amount, type, "appointmentId", "createdAt", "updatedAt"',
        sourceName: 'transactions'
      },
      { 
        name: 'salaries', 
        fields: 'amount, "barberId", "createdAt", "updatedAt"',
        sourceName: 'salaries'
      },
      { 
        name: '"TipTransaction"', 
        fields: 'amount, "appointmentId", "createdAt", "updatedAt"',
        sourceName: 'TipTransaction'
      },
      { 
        name: '"BarberWithdrawalRequest"', 
        fields: '"barberId", amount, description, status, "approvedBy", "createdAt", "updatedAt"',
        sourceName: 'BarberWithdrawalRequest'
      },
      { 
        name: '"Setting"', 
        fields: 'key, value, "createdAt", "updatedAt"',
        sourceName: 'Setting'
      },
      { 
        name: '"Permission"', 
        fields: 'name, description, "createdAt", "updatedAt"',
        sourceName: 'Permission'
      },
      { 
        name: 'sms_logs', 
        fields: 'phone, message, status, "createdAt", "updatedAt"',
        sourceName: 'sms_logs'
      },
      { 
        name: 'sms_settings', 
        fields: 'provider, "apiKey", "apiSecret", "createdAt", "updatedAt"',
        sourceName: 'sms_settings'
      },
      { 
        name: 'sms_templates', 
        fields: 'name, content, "createdAt", "updatedAt"',
        sourceName: 'sms_templates'
      },
      { 
        name: 'profiles', 
        fields: '"userId", avatar, bio, "createdAt", "updatedAt"',
        sourceName: 'profiles'
      }
    ];

    for (const table of tables) {
      console.log(`📊 Migrating ${table.sourceName} to ${table.name}...`);
      try {
        const result = await movaClient.query(`SELECT * FROM "${table.sourceName}"`);
        if (result.rows.length > 0) {
          for (const row of result.rows) {
            // Create a mapping for the fields we want to insert
            const fields = table.fields.split(', ').map(f => f.replace(/"/g, ''));
            const values = fields.map(field => {
              const value = row[field];
              if (value === null) return 'NULL';
              if (typeof value === 'string') {
                return `'${value.replace(/'/g, "''")}'`;
              }
              if (typeof value === 'boolean') {
                return value ? 'true' : 'false';
              }
              if (typeof value === 'number') {
                return value.toString();
              }
              return `'${value}'`;
            });
            
            await zapasClient.query(`INSERT INTO ${table.name} (${table.fields}) VALUES (${values.join(', ')})`);
          }
          console.log(`   ✅ ${table.sourceName}: ${result.rows.length} records migrated`);
        } else {
          console.log(`   ⚠️  ${table.sourceName}: No records found`);
        }
      } catch (error) {
        console.log(`   ❌ ${table.sourceName}: Error - ${error.message}`);
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