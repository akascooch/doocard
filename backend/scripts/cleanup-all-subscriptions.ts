#!/usr/bin/env ts-node
/**
 * Cleanup ALL subscriptions (they have wrong Base64 encoding)
 * Users need to re-subscribe with URL-safe Base64
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanup() {
  console.log('\n🗑️  Cleaning up ALL Push Subscriptions\n');
  console.log('⚠️  Reason: Keys were encoded with wrong Base64 format');
  console.log('Users will need to re-subscribe with URL-safe Base64\n');

  try {
    const result = await prisma.pushSubscription.deleteMany({});

    console.log(`✅ Deleted ${result.count} subscriptions`);
    console.log('\n🔄 Users need to:');
    console.log('  1. Refresh the page');
    console.log('  2. Click "فعال‌سازی اعلان‌ها"');
    console.log('  3. Allow permission');
    console.log('  4. Done!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();

