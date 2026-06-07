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

async function comprehensiveMigration() {
  const movaClient = new Client(movaConfig);
  const zapasClient = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to databases...');
    await movaClient.connect();
    await zapasClient.connect();
    console.log('✅ Connected to both databases');

    // Clear zapas database first
    console.log('🧹 Clearing zapas database...');
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

    // Migration mappings with proper field transformations
    const migrations = [
      {
        name: 'users',
        sourceTable: 'users',
        targetTable: 'users',
        fieldMappings: {
          'email': 'email',
          'password': 'password',
          'firstName': 'firstName',
          'lastName': 'lastName',
          'phoneNumber': 'phoneNumber',
          'isActive': 'isActive',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt',
          'role': 'role'
        }
      },
      {
        name: 'profiles',
        sourceTable: 'profiles',
        targetTable: 'profiles',
        fieldMappings: {
          'userId': 'userId',
          'avatar': 'avatar',
          'bio': 'bio',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'financial_categories',
        sourceTable: 'financial_categories',
        targetTable: 'financial_categories',
        fieldMappings: {
          'name': 'name',
          'type': 'type',
          'description': 'description',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'bank_accounts',
        sourceTable: 'bank_accounts',
        targetTable: 'bank_accounts',
        fieldMappings: {
          'name': 'name',
          'cardNumber': 'cardNumber',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'services',
        sourceTable: 'services',
        targetTable: 'services',
        fieldMappings: {
          'name': 'name',
          'description': 'description',
          'duration': 'duration',
          'price': 'price',
          'isActive': 'isActive',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'barbers',
        sourceTable: 'barbers',
        targetTable: 'barbers',
        fieldMappings: {
          'email': 'email',
          'firstName': 'firstName',
          'lastName': 'lastName',
          'phoneNumber': 'phoneNumber',
          'bio': 'bio',
          'avatar': 'avatar',
          'isActive': 'isActive',
          'type': 'type',
          'salaryPercentage': 'salaryPercentage',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'customers',
        sourceTable: 'customers',
        targetTable: 'customers',
        fieldMappings: {
          'email': 'email',
          'firstName': 'firstName',
          'lastName': 'lastName',
          'phoneNumber': 'phoneNumber',
          'isActive': 'isActive',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt',
          'birthDate': 'birthDate',
          'notes': 'notes',
          'gender': 'gender',
          'rating': 'rating',
          'barberId': 'barberId'
        }
      },
      {
        name: 'appointments',
        sourceTable: 'appointments',
        targetTable: 'appointments',
        fieldMappings: {
          'date': 'date',
          'notes': 'notes',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt',
          'followUpSent': 'followUpSent',
          'reminderSent': 'reminderSent',
          'customerId': 'customerId',
          'barberId': 'barberId',
          'status': 'status'
        }
      },
      {
        name: 'appointment_services',
        sourceTable: 'appointment_services',
        targetTable: 'appointment_services',
        fieldMappings: {
          'appointmentId': 'appointmentId',
          'serviceId': 'serviceId',
          'price': 'price',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'financial_entries',
        sourceTable: 'FinancialEntry',
        targetTable: 'financial_entries',
        fieldMappings: {
          'amount': 'amount',
          'type': 'type',
          'date': 'date',
          'description': 'description',
          'categoryId': 'categoryId',
          'reference': 'reference',
          'paymentMethod': 'paymentMethod',
          'createdBy': 'createdBy',
          'attachmentUrl': 'attachmentUrl',
          'status': 'status',
          'bankAccountId': 'bankAccountId',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'transactions',
        sourceTable: 'transactions',
        targetTable: 'transactions',
        fieldMappings: {
          'amount': 'amount',
          'paymentMethod': 'paymentMethod',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt',
          'appointmentId': 'appointmentId',
          'status': 'status',
          'category': 'category',
          'type': 'type',
          'bankAccountId': 'bankAccountId',
          'description': 'description',
          'financialEntryId': 'financialEntryId'
        }
      },
      {
        name: 'salaries',
        sourceTable: 'salaries',
        targetTable: 'salaries',
        fieldMappings: {
          'barberId': 'barberId',
          'amount': 'amount',
          'month': 'month',
          'isPaid': 'isPaid',
          'paidAt': 'paidAt',
          'description': 'description',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'tip_transactions',
        sourceTable: 'TipTransaction',
        targetTable: 'TipTransaction',
        fieldMappings: {
          'amount': 'amount',
          'date': 'date',
          'staffId': 'staffId',
          'appointmentId': 'appointmentId',
          'type': 'type',
          'status': 'status',
          'createdById': 'createdById'
        }
      },
      {
        name: 'barber_withdrawal_requests',
        sourceTable: 'BarberWithdrawalRequest',
        targetTable: 'BarberWithdrawalRequest',
        fieldMappings: {
          'barberId': 'barberId',
          'amount': 'amount',
          'status': 'status',
          'description': 'description',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt',
          'approvedBy': 'approvedBy'
        }
      },
      {
        name: 'settings',
        sourceTable: 'Setting',
        targetTable: 'Setting',
        fieldMappings: {
          'key': 'key',
          'value': 'value'
        }
      },
      {
        name: 'permissions',
        sourceTable: 'Permission',
        targetTable: 'Permission',
        fieldMappings: {
          'role': 'role',
          'userId': 'userId',
          'page': 'page',
          'feature': 'feature',
          'canView': 'canView',
          'canEdit': 'canEdit',
          'canDelete': 'canDelete',
          'canCreate': 'canCreate',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'sms_logs',
        sourceTable: 'sms_logs',
        targetTable: 'sms_logs',
        fieldMappings: {
          'phoneNumber': 'phoneNumber',
          'message': 'message',
          'status': 'status',
          'error': 'error',
          'createdAt': 'createdAt',
          'customerId': 'customerId'
        }
      },
      {
        name: 'sms_settings',
        sourceTable: 'sms_settings',
        targetTable: 'sms_settings',
        fieldMappings: {
          'apiKey': 'apiKey',
          'lineNumber': 'lineNumber',
          'isEnabled': 'isEnabled',
          'sendBeforeAppointment': 'sendBeforeAppointment',
          'sendAfterAppointment': 'sendAfterAppointment',
          'defaultMessage': 'defaultMessage',
          'updatedAt': 'updatedAt'
        }
      },
      {
        name: 'sms_templates',
        sourceTable: 'sms_templates',
        targetTable: 'sms_templates',
        fieldMappings: {
          'name': 'name',
          'content': 'content',
          'variables': 'variables',
          'isActive': 'isActive',
          'createdAt': 'createdAt',
          'updatedAt': 'updatedAt'
        }
      }
    ];

    // Execute migrations
    for (const migration of migrations) {
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
          // Build the INSERT query
          const targetFields = Object.keys(migration.fieldMappings);
          const sourceFields = Object.values(migration.fieldMappings);
          
          const values = targetFields.map(field => {
            const sourceField = migration.fieldMappings[field];
            const value = row[sourceField];
            
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
            INSERT INTO "${migration.targetTable}" (${targetFields.map(f => `"${f}"`).join(', ')})
            VALUES (${values.join(', ')})
          `;

          try {
            await zapasClient.query(insertQuery);
            migratedCount++;
          } catch (error) {
            console.log(`   ❌ Error inserting record: ${error.message}`);
            console.log(`   Query: ${insertQuery}`);
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
          await zapasClient.query(`
            INSERT INTO "_BarberToService" ("A", "B")
            VALUES (${row.A}, ${row.B})
          `);
        }
        console.log(`   ✅ Barber-service relationships: ${barberServices.rows.length} records migrated`);
      }
    } catch (error) {
      console.log(`   ❌ Error migrating barber-service relationships: ${error.message}`);
    }

    console.log('🎉 Comprehensive migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await movaClient.end();
    await zapasClient.end();
  }
}

comprehensiveMigration(); 