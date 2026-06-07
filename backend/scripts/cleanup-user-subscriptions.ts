#!/usr/bin/env ts-node
/**
 * Clean up subscriptions for a specific user
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupUserSubscriptions() {
  const userPhone = '09304013878'; // Amir mova
  
  console.log(`\n🗑️  Cleaning up subscriptions for ${userPhone}\n`);
  console.log('='.repeat(60));

  try {
    // Find user
    const user = await prisma.user.findFirst({
      where: { phone: userPhone },
      include: { pushSubscriptions: true },
    });

    if (!user) {
      console.log(`❌ User not found: ${userPhone}`);
      await prisma.$disconnect();
      return;
    }

    console.log(`\n👤 User: ${user.name} (ID: ${user.id})`);
    console.log(`📊 Subscriptions: ${user.pushSubscriptions.length}\n`);

    if (user.pushSubscriptions.length === 0) {
      console.log('✅ No subscriptions to clean up');
      await prisma.$disconnect();
      return;
    }

    // Delete all subscriptions
    const result = await prisma.pushSubscription.deleteMany({
      where: { userId: user.id },
    });

    console.log(`✅ Deleted ${result.count} subscription(s)`);
    console.log('\n' + '='.repeat(60));
    console.log('📱 User needs to re-subscribe with fresh subscription');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanupUserSubscriptions();

