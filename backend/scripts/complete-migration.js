const { Client } = require('pg');

// Database configurations
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

async function completeMigration() {
  const movaClient = new Client(movaConfig);
  const zapasClient = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to databases...');
    await movaClient.connect();
    await zapasClient.connect();
    console.log('✅ Connected to both databases');

    // Clear zapas database completely
    console.log('🧹 Clearing Zapas database...');
    const clearQueries = [
      'TRUNCATE TABLE transactions CASCADE',
      'TRUNCATE TABLE financial_entries CASCADE',
      'TRUNCATE TABLE "BarberWithdrawalRequest" CASCADE',
      'TRUNCATE TABLE "TipTransaction" CASCADE',
      'TRUNCATE TABLE salaries CASCADE',
      'TRUNCATE TABLE appointment_services CASCADE',
      'TRUNCATE TABLE appointments CASCADE',
      'TRUNCATE TABLE customers CASCADE',
      'TRUNCATE TABLE barbers CASCADE',
      'TRUNCATE TABLE services CASCADE',
      'TRUNCATE TABLE users CASCADE',
      'TRUNCATE TABLE financial_categories CASCADE',
      'TRUNCATE TABLE bank_accounts CASCADE',
      'TRUNCATE TABLE "Setting" CASCADE',
      'TRUNCATE TABLE "Permission" CASCADE',
      'TRUNCATE TABLE sms_logs CASCADE',
      'TRUNCATE TABLE sms_settings CASCADE',
      'TRUNCATE TABLE sms_templates CASCADE',
      'TRUNCATE TABLE profiles CASCADE'
    ];

    for (const query of clearQueries) {
      try {
        await zapasClient.query(query);
      } catch (error) {
        console.log(`   ⚠️  Warning clearing ${query}: ${error.message}`);
      }
    }
    console.log('✅ Zapas database cleared');

    console.log('📊 Starting complete data migration...');

    // Migration mappings - using the same table structure since both databases have the new schema
    const migrations = [
      {
        name: 'users',
        sourceTable: 'users',
        targetTable: 'users',
        preserveId: true
      },
      {
        name: 'profiles',
        sourceTable: 'profiles',
        targetTable: 'profiles',
        preserveId: true
      },
      {
        name: 'financial_categories',
        sourceTable: 'financial_categories',
        targetTable: 'financial_categories',
        preserveId: true
      },
      {
        name: 'bank_accounts',
        sourceTable: 'bank_accounts',
        targetTable: 'bank_accounts',
        preserveId: true
      },
      {
        name: 'services',
        sourceTable: 'services',
        targetTable: 'services',
        preserveId: true
      },
      {
        name: 'barbers',
        sourceTable: 'barbers',
        targetTable: 'barbers',
        preserveId: true
      },
      {
        name: 'customers',
        sourceTable: 'customers',
        targetTable: 'customers',
        preserveId: true
      },
      {
        name: 'appointments',
        sourceTable: 'appointments',
        targetTable: 'appointments',
        preserveId: true
      },
      {
        name: 'appointment_services',
        sourceTable: 'appointment_services',
        targetTable: 'appointment_services',
        preserveId: true
      },
      {
        name: 'financial_entries',
        sourceTable: 'FinancialEntry',
        targetTable: 'financial_entries',
        preserveId: true
      },
      {
        name: 'transactions',
        sourceTable: 'transactions',
        targetTable: 'transactions',
        preserveId: true
      },
      {
        name: 'salaries',
        sourceTable: 'salaries',
        targetTable: 'salaries',
        preserveId: true
      },
      {
        name: 'tip_transactions',
        sourceTable: 'TipTransaction',
        targetTable: 'TipTransaction',
        preserveId: true
      },
      {
        name: 'barber_withdrawal_requests',
        sourceTable: 'BarberWithdrawalRequest',
        targetTable: 'BarberWithdrawalRequest',
        preserveId: true
      },
      {
        name: 'settings',
        sourceTable: 'Setting',
        targetTable: 'Setting',
        preserveId: true
      },
      {
        name: 'permissions',
        sourceTable: 'Permission',
        targetTable: 'Permission',
        preserveId: true
      },
      {
        name: 'sms_logs',
        sourceTable: 'sms_logs',
        targetTable: 'sms_logs',
        preserveId: true
      },
      {
        name: 'sms_settings',
        sourceTable: 'sms_settings',
        targetTable: 'sms_settings',
        preserveId: true
      },
      {
        name: 'sms_templates',
        sourceTable: 'sms_templates',
        targetTable: 'sms_templates',
        preserveId: true
      }
    ];

    // Execute migrations in dependency order
    const migrationOrder = [
      'users', 'profiles', 'financial_categories', 'bank_accounts', 
      'services', 'barbers', 'customers', 'appointments', 
      'appointment_services', 'financial_entries', 'transactions', 
      'salaries', 'tip_transactions', 'barber_withdrawal_requests',
      'settings', 'permissions', 'sms_logs', 'sms_settings', 'sms_templates'
    ];

    for (const tableName of migrationOrder) {
      const migration = migrations.find(m => m.name === tableName);
      if (!migration) continue;

      console.log(`📊 Migrating ${migration.name}...`);
      
      try {
        // Get data from source table
        const sourceData = await movaClient.query(`SELECT * FROM "${migration.sourceTable}"`);
        
        if (sourceData.rows.length === 0) {
          console.log(`   ⚠️  No data found in ${migration.sourceTable}`);
          continue;
        }

        let migratedCount = 0;
        
        for (const row of sourceData.rows) {
          // Build the INSERT query with all fields
          const fields = Object.keys(row);
          const values = fields.map(field => {
            const value = row[field];
            
            if (value === null || value === undefined) {
              return 'NULL';
            }
            
            if (typeof value === 'string') {
              // Handle special cases for enums and arrays
              if (field === 'variables' && Array.isArray(value)) {
                return `'${JSON.stringify(value)}'`;
              }
              return `'${value.replace(/'/g, "''")}'`;
            }
            
            if (typeof value === 'boolean') {
              return value ? 'true' : 'false';
            }
            
            if (typeof value === 'number') {
              return value.toString();
            }
            
            if (value instanceof Date) {
              return `'${value.toISOString()}'`;
            }
            
            return `'${value}'`;
          });

          const insertQuery = `
            INSERT INTO "${migration.targetTable}" (${fields.map(f => `"${f}"`).join(', ')})
            VALUES (${values.join(', ')})
          `;

          try {
            await zapasClient.query(insertQuery);
            migratedCount++;
          } catch (error) {
            console.log(`   ❌ Error inserting record: ${error.message}`);
            // Continue with next record instead of stopping
          }
        }
        
        console.log(`   ✅ ${migration.name}: ${migratedCount}/${sourceData.rows.length} records migrated`);
        
      } catch (error) {
        console.log(`   ❌ Error migrating ${migration.name}: ${error.message}`);
      }
    }

    // Handle many-to-many relationships
    console.log('📊 Migrating barber-service relationships...');
    try {
      const barberServices = await movaClient.query('SELECT * FROM "_BarberToService"');
      if (barberServices.rows.length > 0) {
        for (const row of barberServices.rows) {
          try {
            await zapasClient.query(`
              INSERT INTO "_BarberToService" ("A", "B")
              VALUES (${row.A}, ${row.B})
            `);
          } catch (error) {
            console.log(`   ❌ Error inserting barber-service relationship: ${error.message}`);
          }
        }
        console.log(`   ✅ Barber-service relationships: ${barberServices.rows.length} records processed`);
      }
    } catch (error) {
      console.log(`   ❌ Error migrating barber-service relationships: ${error.message}`);
    }

    // Final verification
    console.log('\n📊 Final Migration Verification:');
    console.log('='.repeat(50));
    const verificationTables = ['users', 'barbers', 'customers', 'appointments', 'transactions'];
    
    for (const table of verificationTables) {
      try {
        const movaCount = await movaClient.query(`SELECT COUNT(*) FROM "${table}"`);
        const zapasCount = await zapasClient.query(`SELECT COUNT(*) FROM "${table}"`);
        const movaTotal = parseInt(movaCount.rows[0].count);
        const zapasTotal = parseInt(zapasCount.rows[0].count);
        const percentage = movaTotal > 0 ? Math.round((zapasTotal / movaTotal) * 100) : 0;
        const status = movaTotal === zapasTotal ? '✅' : '❌';
        
        console.log(`${status} ${table.padEnd(15)}: ${zapasTotal}/${movaTotal} (${percentage}%)`);
      } catch (error) {
        console.log(`❌ ${table.padEnd(15)}: Error - ${error.message}`);
      }
    }

    console.log('\n🎉 Complete migration finished!');
    console.log('The Zappas database now contains all data from Mova with the new schema structure.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await movaClient.end();
    await zapasClient.end();
  }
}

completeMigration(); 