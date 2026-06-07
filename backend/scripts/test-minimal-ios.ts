#!/usr/bin/env ts-node
/**
 * Test with absolutely minimal options
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function testMinimal() {
  console.log('\n🧪 Testing with MINIMAL options\n');

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const sub = await prisma.pushSubscription.findFirst({
      where: { userId: 3, endpoint: { contains: 'apple' } },
    });

    if (!sub) {
      console.log('❌ No subscription');
      await prisma.$disconnect();
      return;
    }

    console.log(`Endpoint: ${sub.endpoint.substring(0, 50)}...`);
    console.log(`p256dh: ${sub.p256dh}`);
    console.log(`auth: ${sub.auth}\n`);

    const payload = JSON.stringify({
      title: '🧪 Minimal Test',
      body: 'Testing with minimal options',
    });

    // Test with ZERO headers and NO topic
    console.log('Test: NO headers, NO topic');
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
      console.log('✅ SUCCESS!\n');
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.message}\n`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
  }
}

testMinimal();

