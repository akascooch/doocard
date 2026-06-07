const { Client } = require('pg');

const zapasConfig = {
  host: 'localhost',
  port: 5433,
  database: 'zapas',
  user: 'postgres',
  password: 'Lord7know$'
};

async function checkTables() {
  const client = new Client(zapasConfig);

  try {
    console.log('🔍 Connecting to zapas database...');
    await client.connect();
    console.log('✅ Connected to zapas database');

    // Get all tables
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('📊 Tables in zapas database:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    // Get table counts
    console.log('\n📊 Table record counts:');
    for (const row of result.rows) {
      try {
        const countResult = await client.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
        console.log(`   ${row.table_name}: ${countResult.rows[0].count} records`);
      } catch (error) {
        console.log(`   ${row.table_name}: Error - ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkTables(); 