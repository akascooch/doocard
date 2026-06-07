#!/usr/bin/env ts-node
/**
 * Debug iOS push notification with multiple encoding attempts
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function debugIOSPush() {
  console.log('\n🐛 Debug iOS Push Notification\n');
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
      console.log('Please subscribe first!');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Found subscription for ${sub.user.name}`);
    console.log(`Endpoint: ${sub.endpoint}`);
    console.log(`\np256dh: "${sub.p256dh}"`);
    console.log(`  Length: ${sub.p256dh.length}`);
    console.log(`  Has '-': ${sub.p256dh.includes('-')}`);
    console.log(`  Has '_': ${sub.p256dh.includes('_')}`);
    console.log(`  Has '+': ${sub.p256dh.includes('+')}`);
    console.log(`  Has '/': ${sub.p256dh.includes('/')}`);
    console.log(`  Has '=': ${sub.p256dh.includes('=')}`);
    console.log(`\nauth: "${sub.auth}"`);
    console.log(`  Length: ${sub.auth.length}`);
    console.log(`  Has '-': ${sub.auth.includes('-')}`);
    console.log(`  Has '_': ${sub.auth.includes('_')}`);
    console.log(`  Has '+': ${sub.auth.includes('+')}`);
    console.log(`  Has '/': ${sub.auth.includes('/')}`);
    console.log(`  Has '=': ${sub.auth.includes('=')}`);
    console.log('\n' + '='.repeat(80));

    const payload = JSON.stringify({
      title: '🧪 تست iOS - Debug',
      body: 'اگر این را دیدید، iOS کار می‌کند! ✅',
      icon: 'https://www.doocardbarbershop.com/logo/logo-192.png',
      data: { url: '/dashboard', test: true },
    });

    const options: any = {
      TTL: 3600,
      urgency: 'high',
      topic: 'www.doocardbarbershop.com',
      headers: {
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
        'apns-priority': '10',
        'apns-push-type': 'alert',
        'apns-topic': 'www.doocardbarbershop.com',
      },
    };

    // Try sending with different methods
    console.log('\n📤 Attempt 1: Using URL-safe Base64 as-is (no conversion)\n');
    try {
      const pushSub1 = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      console.log('Sending with keys:', pushSub1.keys);
      await webpush.sendNotification(pushSub1, payload, options);
      console.log('✅ Attempt 1: SUCCESS!\n');
    } catch (error: any) {
      console.log(`❌ Attempt 1 FAILED: ${error.message}\n`);
    }

    // Try with Buffer
    console.log('📤 Attempt 2: Using Buffer.from(key, "base64url")\n');
    try {
      const pushSub2 = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: Buffer.from(sub.p256dh, 'base64url'),
          auth: Buffer.from(sub.auth, 'base64url'),
        },
      };

      console.log('Sending with Buffer (base64url)');
      await webpush.sendNotification(pushSub2, payload, options);
      console.log('✅ Attempt 2: SUCCESS!\n');
    } catch (error: any) {
      console.log(`❌ Attempt 2 FAILED: ${error.message}\n`);
    }

    // Try with base64 (after adding padding)
    console.log('📤 Attempt 3: Adding padding and using Buffer.from(key, "base64")\n');
    try {
      // Add padding
      const p256dhPadded = sub.p256dh + '='.repeat((4 - (sub.p256dh.length % 4)) % 4);
      const authPadded = sub.auth + '='.repeat((4 - (sub.auth.length % 4)) % 4);
      
      // Convert - and _ to + and /
      const p256dhStd = p256dhPadded.replace(/-/g, '+').replace(/_/g, '/');
      const authStd = authPadded.replace(/-/g, '+').replace(/_/g, '/');

      const pushSub3 = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: Buffer.from(p256dhStd, 'base64'),
          auth: Buffer.from(authStd, 'base64'),
        },
      };

      console.log('p256dh (converted):', p256dhStd.substring(0, 30) + '...');
      console.log('auth (converted):', authStd);
      console.log('Sending with Buffer (base64)');
      await webpush.sendNotification(pushSub3, payload, options);
      console.log('✅ Attempt 3: SUCCESS!\n');
    } catch (error: any) {
      console.log(`❌ Attempt 3 FAILED: ${error.message}\n`);
    }

    console.log('='.repeat(80));
    console.log('⏳ Check your iPhone for notification');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugIOSPush();

