#!/usr/bin/env node
/**
 * Direct SQL query to check subscriptions
 */

const { Client } = require('pg');

async function checkSubs() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'doocard',
    user: 'doocard',
    password: 'doocard2024',
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const result = await client.query('SELECT COUNT(*) FROM "PushSubscription"');
    console.log(`Total subscriptions: ${result.rows[0].count}`);
    
    if (result.rows[0].count > 0) {
      const subs = await client.query(`
        SELECT ps.id, ps."userId", u.name, u.phone, 
               SUBSTRING(ps.endpoint, 1, 50) as endpoint_preview,
               ps."createdAt"
        FROM "PushSubscription" ps
        JOIN "User" u ON ps."userId" = u.id
        ORDER BY ps.id DESC
        LIMIT 10
      `);
      
      console.log('\nRecent subscriptions:');
      subs.rows.forEach(row => {
        console.log(`  ID ${row.id}: ${row.name} (${row.phone})`);
        console.log(`    Endpoint: ${row.endpoint_preview}...`);
        console.log(`    Created: ${row.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkSubs();

