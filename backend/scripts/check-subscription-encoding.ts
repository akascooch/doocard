#!/usr/bin/env ts-node
/**
 * Check the actual encoding of subscriptions in database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkEncoding() {
  console.log('\n🔍 Checking subscription encoding in database\n');
  console.log('='.repeat(80));

  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      include: {
        user: {
          select: { name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n📊 Found ${subscriptions.length} subscriptions\n`);

    subscriptions.forEach((sub, index) => {
      console.log(`\n[${index + 1}] ${sub.user.name} (${sub.user.phone})`);
      console.log('─'.repeat(80));
      
      const isApple = sub.endpoint.includes('apple');
      const isFCM = sub.endpoint.includes('fcm.googleapis');
      const platform = isApple ? '🍎 iOS' : isFCM ? '🤖 Android' : '🌐 Other';
      
      console.log(`Platform: ${platform}`);
      console.log(`Endpoint: ${sub.endpoint.substring(0, 70)}...`);
      console.log(`\np256dh (full): ${sub.p256dh}`);
      console.log(`p256dh length: ${sub.p256dh.length}`);
      console.log(`p256dh contains '+': ${sub.p256dh.includes('+')}`);
      console.log(`p256dh contains '-': ${sub.p256dh.includes('-')}`);
      console.log(`p256dh contains '/': ${sub.p256dh.includes('/')}`);
      console.log(`p256dh contains '_': ${sub.p256dh.includes('_')}`);
      console.log(`p256dh has padding: ${sub.p256dh.endsWith('=')}`);
      
      console.log(`\nauth (full): ${sub.auth}`);
      console.log(`auth length: ${sub.auth.length}`);
      console.log(`auth contains '+': ${sub.auth.includes('+')}`);
      console.log(`auth contains '-': ${sub.auth.includes('-')}`);
      console.log(`auth contains '/': ${sub.auth.includes('/')}`);
      console.log(`auth contains '_': ${sub.auth.includes('_')}`);
      console.log(`auth has padding: ${sub.auth.endsWith('=')}`);
      
      // Determine encoding format
      const p256dhFormat = (sub.p256dh.includes('-') || sub.p256dh.includes('_')) ? 
        '🔴 URL-safe Base64' : '✅ Standard Base64';
      const authFormat = (sub.auth.includes('-') || sub.auth.includes('_')) ? 
        '🔴 URL-safe Base64' : '✅ Standard Base64';
      
      console.log(`\nEncoding:`);
      console.log(`  p256dh: ${p256dhFormat}`);
      console.log(`  auth: ${authFormat}`);
      
      console.log('='.repeat(80));
    });

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEncoding();

