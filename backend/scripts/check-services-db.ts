#!/usr/bin/env ts-node
/**
 * Check Services in Database
 */
import { PrismaClient } from '@prisma/client';

async function checkServices() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Checking services in database...\n');

    const services = await prisma.service.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`📊 Total services: ${services.length}\n`);

    if (services.length === 0) {
      console.log('❌ No services found in database!');
      console.log('\n💡 You need to add services through the admin panel first.');
    } else {
      console.log('✅ Services found:\n');
      services.forEach((service, index) => {
        console.log(`${index + 1}. ${service.name}`);
        console.log(`   ID: ${service.id}`);
        console.log(`   Description: ${service.description || 'N/A'}`);
        console.log(`   Duration: ${service.durationMinutes} min`);
        console.log(`   Price: ${service.price} تومان`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkServices();

