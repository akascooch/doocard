#!/usr/bin/env ts-node
/**
 * Test ALL possible methods for iOS push
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function testAllMethods() {
  console.log('\n🧪 Testing ALL methods for iOS Push\n');
  console.log('='.repeat(80));

  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const sub = await prisma.pushSubscription.findFirst({
      where: { userId: 3, endpoint: { contains: 'apple' } },
      include: { user: true },
    });

    if (!sub) {
      console.log('❌ No iOS subscription for Amir mova');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Found: ${sub.user.name}`);
    console.log(`p256dh: ${sub.p256dh}`);
    console.log(`auth: ${sub.auth}\n`);

    const payload = JSON.stringify({
      title: '🧪 iOS Test',
      body: 'Testing...',
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

    // Test 1: Direct string (URL-safe)
    console.log('Test 1: Direct string (URL-safe as-is)');
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        options
      );
      console.log('✅ SUCCESS!\n');
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.message}\n`);
    }

    // Test 2: Buffer.from base64url
    console.log('Test 2: Buffer.from(key, "base64url")');
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: Buffer.from(sub.p256dh, 'base64url'),
            auth: Buffer.from(sub.auth, 'base64url'),
          },
        },
        payload,
        options
      );
      console.log('✅ SUCCESS!\n');
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.message}\n`);
    }

    // Test 3: ArrayBuffer (Uint8Array)
    console.log('Test 3: Uint8Array from base64url');
    try {
      const p256dhBytes = Buffer.from(sub.p256dh, 'base64url');
      const authBytes = Buffer.from(sub.auth, 'base64url');
      
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: new Uint8Array(p256dhBytes),
            auth: new Uint8Array(authBytes),
          },
        },
        payload,
        options
      );
      console.log('✅ SUCCESS!\n');
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.message}\n`);
    }

    console.log('='.repeat(80));
    console.log('⏳ Check iPhone if any test succeeded');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAllMethods();

