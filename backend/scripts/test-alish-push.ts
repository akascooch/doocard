#!/usr/bin/env ts-node
/**
 * Test sending to alish with detailed debugging
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function testAlishPush() {
  console.log('\n🧪 Testing alish iPhone Push\n');
  console.log('='.repeat(80));

  try {
    // Configure webpush
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Get alish subscription
    const sub = await prisma.pushSubscription.findFirst({
      where: { userId: 12 },
      include: { user: true },
    });

    if (!sub) {
      console.log('❌ No subscription found');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Found: ${sub.user.name} (${sub.user.phone})`);
    console.log(`Platform: ${sub.endpoint.includes('apple') ? 'iOS' : 'Android'}`);
    console.log(`\np256dh from DB: "${sub.p256dh}"`);
    console.log(`  Length: ${sub.p256dh.length}`);
    console.log(`  Has '-': ${sub.p256dh.includes('-')}`);
    console.log(`  Has '_': ${sub.p256dh.includes('_')}`);
    console.log(`  Has '+': ${sub.p256dh.includes('+')}`);
    console.log(`  Has '/': ${sub.p256dh.includes('/')}`);
    console.log(`  Ends with '=': ${sub.p256dh.endsWith('=')}`);
    
    console.log(`\nauth from DB: "${sub.auth}"`);
    console.log(`  Length: ${sub.auth.length}`);
    console.log(`  Has '-': ${sub.auth.includes('-')}`);
    console.log(`  Has '_': ${sub.auth.includes('_')}`);
    console.log(`  Has '+': ${sub.auth.includes('+')}`);
    console.log(`  Has '/': ${sub.auth.includes('/')}`);
    console.log(`  Ends with '=': ${sub.auth.endsWith('=')}`);

    console.log('\n' + '='.repeat(80));
    console.log('📤 Attempting to send notification...\n');

    const payload = JSON.stringify({
      title: '🧪 تست alish iPhone',
      body: 'اگر این را دیدید، موفق شدیم! ✅',
      icon: 'https://www.doocardbarbershop.com/logo/logo-192.png',
      data: { url: '/dashboard', test: true },
    });

    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    console.log('Sending with keys (no conversion):');
    console.log(`  p256dh: ${sub.p256dh.substring(0, 30)}...`);
    console.log(`  auth: ${sub.auth}`);

    await webpush.sendNotification(pushSub, payload, {
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

    console.log('\n✅ SUCCESS! Notification sent to alish iPhone!');
    console.log('⏳ Check the device in the next 10-30 seconds\n');
    console.log('='.repeat(80));

  } catch (error: any) {
    console.log(`\n❌ FAILED: ${error.message}`);
    if (error.body) {
      console.log(`Body: ${error.body}`);
    }
    console.log('\n' + '='.repeat(80));
  } finally {
    await prisma.$disconnect();
  }
}

testAlishPush();

