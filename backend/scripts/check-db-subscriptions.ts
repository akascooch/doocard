#!/usr/bin/env ts-node
/**
 * Direct database check
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDB() {
  console.log('\n📊 Direct Database Check\n');
  
  try {
    const count = await prisma.pushSubscription.count();
    console.log(`Total subscriptions: ${count}`);
    
    if (count > 0) {
      const subs = await prisma.pushSubscription.findMany({
        include: { user: true },
        orderBy: { id: 'desc' },
        take: 10,
      });
      
      console.log('\nRecent subscriptions:');
      subs.forEach(s => {
        console.log(`  ID ${s.id}: ${s.user.name} (${s.user.phone})`);
        console.log(`    Endpoint: ${s.endpoint.substring(0, 50)}...`);
        console.log(`    Created: ${s.createdAt}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDB();

