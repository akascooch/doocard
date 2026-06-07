const { Client } = require('pg');

const movaConfig = {
  host: 'localhost',
  port: 5433,
  database: 'mova',
  user: 'postgres',
  password: 'Lord7know$'
};

async function checkMovaCounts() {
  const client = new Client(movaConfig);

  try {
    console.log('🔍 Connecting to mova database...');
    await client.connect();
    console.log('✅ Connected to mova database');

    // Check all tables with counts
    const tables = ['users', 'barbers', 'customers', 'appointments', 'services', 'transactions', 'financial_entries'];
    
    for (const table of tables) {
      console.log(`\n📊 ${table} table:`);
      
      // Get total count
      const countResult = await client.query(`SELECT COUNT(*) FROM "${table}"`);
      console.log(`   Total records: ${countResult.rows[0].count}`);
      
      // Get count of records with non-null important fields
      if (table === 'users') {
        const nonNullCount = await client.query(`SELECT COUNT(*) FROM "${table}" WHERE email IS NOT NULL`);
        console.log(`   Records with email: ${nonNullCount.rows[0].count}`);
      } else if (table === 'barbers') {
        const nonNullCount = await client.query(`SELECT COUNT(*) FROM "${table}" WHERE email IS NOT NULL`);
        console.log(`   Records with email: ${nonNullCount.rows[0].count}`);
      } else if (table === 'customers') {
        const nonNullCount = await client.query(`SELECT COUNT(*) FROM "${table}" WHERE "firstName" IS NOT NULL OR "lastName" IS NOT NULL`);
        console.log(`   Records with name: ${nonNullCount.rows[0].count}`);
      } else if (table === 'appointments') {
        const nonNullCount = await client.query(`SELECT COUNT(*) FROM "${table}" WHERE date IS NOT NULL`);
        console.log(`   Records with date: ${nonNullCount.rows[0].count}`);
      }
      
      // Show sample of non-null records
      if (table === 'users') {
        const sample = await client.query(`SELECT * FROM "${table}" WHERE email IS NOT NULL LIMIT 2`);
        if (sample.rows.length > 0) {
          console.log(`   Sample records:`);
          sample.rows.forEach((row, index) => {
            console.log(`     ${index + 1}. ID: ${row.id}, Email: ${row.email}, Role: ${row.role}`);
          });
        }
      } else if (table === 'barbers') {
        const sample = await client.query(`SELECT * FROM "${table}" WHERE email IS NOT NULL LIMIT 2`);
        if (sample.rows.length > 0) {
          console.log(`   Sample records:`);
          sample.rows.forEach((row, index) => {
            console.log(`     ${index + 1}. ID: ${row.id}, Email: ${row.email}, Type: ${row.type}`);
          });
        }
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkMovaCounts(); 