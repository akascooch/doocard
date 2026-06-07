#!/usr/bin/env ts-node
/**
 * Cleanup all Apple subscriptions (they're all expired)
 * User will need to re-subscribe from iPhone
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('\n🗑️  Cleaning up Apple Push Subscriptions\n');

  try {
    const result = await prisma.pushSubscription.deleteMany({
      where: {
        endpoint: { contains: 'apple.com' },
      },
    });

    console.log(`✅ Deleted ${result.count} Apple subscriptions`);
    console.log('User will need to re-subscribe from iPhone');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();

