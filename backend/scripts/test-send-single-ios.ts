#!/usr/bin/env ts-node
/**
 * Test sending to a single iOS subscription with different encoding methods
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function testSendToIOS() {
  console.log('\n🧪 Testing iOS push with different encoding methods\n');
  console.log('='.repeat(80));

  try {
    // Configure webpush
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Get Amir mova's iOS subscription
    const sub = await prisma.pushSubscription.findFirst({
      where: {
        user: { phone: '09304013878' },
        endpoint: { contains: 'apple' },
      },
      include: { user: true },
    });

    if (!sub) {
      console.log('❌ No iOS subscription found for Amir mova');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Found subscription for ${sub.user.name}`);
    console.log(`Endpoint: ${sub.endpoint.substring(0, 70)}...`);
    console.log(`\np256dh: ${sub.p256dh}`);
    console.log(`auth: ${sub.auth}`);
    console.log('\n' + '='.repeat(80));

    const payload = JSON.stringify({
      title: '🧪 تست iOS',
      body: 'اگر این را دیدید، iOS کار می‌کند! ✅',
      icon: 'https://www.doocardbarbershop.com/logo/logo-192.png',
      data: { url: '/dashboard', test: true },
    });

    // Method 1: Direct string (current method)
    console.log('\n📤 Method 1: Using strings directly\n');
    try {
      const pushSub1 = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      await webpush.sendNotification(pushSub1, payload, {
        TTL: 3600,
        urgency: 'high',
        topic: 'www.doocardbarbershop.com',
        headers: {
          'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
          'apns-priority': '10',
          'apns-push-type': 'alert',
          'apns-topic': 'www.doocardbarbershop.com',
        },
      });

      console.log('✅ Method 1: SUCCESS!');
    } catch (error: any) {
      console.log(`❌ Method 1 FAILED: ${error.message}`);
    }

    // Method 2: Using Buffer.from with base64
    console.log('\n📤 Method 2: Using Buffer.from with "base64"\n');
    try {
      const pushSub2 = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: Buffer.from(sub.p256dh, 'base64'),
          auth: Buffer.from(sub.auth, 'base64'),
        },
      };

      await webpush.sendNotification(pushSub2, payload, {
        TTL: 3600,
        urgency: 'high',
        topic: 'www.doocardbarbershop.com',
        headers: {
          'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
          'apns-priority': '10',
          'apns-push-type': 'alert',
          'apns-topic': 'www.doocardbarbershop.com',
        },
      });

      console.log('✅ Method 2: SUCCESS!');
    } catch (error: any) {
      console.log(`❌ Method 2 FAILED: ${error.message}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('⏳ Check your iPhone for notification in the next 10-30 seconds');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSendToIOS();

