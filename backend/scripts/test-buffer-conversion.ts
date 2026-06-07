#!/usr/bin/env ts-node
/**
 * Test if using Buffer helps
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function testBufferConversion() {
  console.log('\n🧪 Testing Buffer conversion for iOS\n');
  console.log('='.repeat(80));

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const sub = await prisma.pushSubscription.findFirst({
      where: { userId: 12 },
      include: { user: true },
    });

    if (!sub) {
      console.log('❌ No subscription');
      await prisma.$disconnect();
      return;
    }

    console.log(`Testing: ${sub.user.name}`);
    console.log(`p256dh: ${sub.p256dh}`);
    console.log(`auth: ${sub.auth}\n`);

    const payload = JSON.stringify({
      title: '🧪 Buffer Test',
      body: 'Testing Buffer conversion',
      icon: 'https://www.doocardbarbershop.com/logo/logo-192.png',
    });

    const options = {
      TTL: 3600,
      urgency: 'high' as const,
      topic: 'www.doocardbarbershop.com',
      headers: {
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
        'apns-priority': '10',
        'apns-push-type': 'alert',
        'apns-topic': 'www.doocardbarbershop.com',
      },
    };

    // Test 1: Using Buffer.from
    console.log('Test 1: Buffer.from(key, "base64")');
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: Buffer.from(sub.p256dh, 'base64'),
            auth: Buffer.from(sub.auth, 'base64'),
          },
        },
        payload,
        options
      );
      console.log('✅ SUCCESS with Buffer.from!\n');
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.message}\n`);
    }

    // Test 2: Using string directly  
    console.log('Test 2: String directly');
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload,
        options
      );
      console.log('✅ SUCCESS with string!\n');
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.message}\n`);
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBufferConversion();

