const { Client } = require('pg');

const movaConfig = {
  host: 'localhost',
  port: 5433,
  database: 'mova',
  user: 'postgres',
  password: 'Lord7know$'
};

async function checkMovaTables() {
  const client = new Client(movaConfig);

  try {
    console.log('🔍 Connecting to mova database...');
    await client.connect();
    console.log('✅ Connected to mova database');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Available tables in mova database:');
    tablesResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });

    // Check structure of key tables
    const keyTables = ['users', 'barbers', 'customers', 'appointments'];
    
    for (const tableName of keyTables) {
      console.log(`\n🔍 Structure of ${tableName} table:`);
      try {
        const structureResult = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns 
          WHERE table_name = '${tableName}'
          ORDER BY ordinal_position
        `);
        
        structureResult.rows.forEach(row => {
          console.log(`   ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
        });
      } catch (error) {
        console.log(`   ❌ Error getting structure: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkMovaTables(); 