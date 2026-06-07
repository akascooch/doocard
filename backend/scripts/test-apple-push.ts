#!/usr/bin/env ts-node
/**
 * Test Apple Push specifically
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function testApplePush() {
  console.log('\n🍎 Testing Apple Push Notifications\n');

  try {
    // Configure web-push
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Get Apple subscriptions
    const appleSubs = await prisma.pushSubscription.findMany({
      where: { endpoint: { contains: 'apple' } },
      include: { user: { select: { name: true, phone: true } } },
    });

    console.log(`Found ${appleSubs.length} Apple subscriptions\n`);

    if (appleSubs.length === 0) {
      console.log('⚠️  No Apple subscriptions found');
      await prisma.$disconnect();
      return;
    }

    // Test each one
    for (const sub of appleSubs) {
      console.log(`Testing: ${sub.user.name} (${sub.user.phone})`);
      console.log(`Endpoint: ${sub.endpoint.substring(0, 60)}...`);

      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      const payload = JSON.stringify({
        title: '🧪 تست iOS',
        body: 'این یک پیام تستی برای iOS است',
        icon: '/logo/logo-192.png',
        data: { url: '/dashboard', test: true },
      });

      // Apple requires specific headers
      const options = {
        TTL: 3600,
        urgency: 'high' as const,
        topic: 'com.doocard.barbershop.web',
        headers: {
          'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
          'apns-priority': '10',
          'apns-push-type': 'alert',
          'apns-topic': 'com.doocard.barbershop.web',
        },
      };

      try {
        const result = await webpush.sendNotification(pushSub, payload, options);
        console.log('✅ SUCCESS:', result.statusCode);
        console.log('Headers:', result.headers);
      } catch (error: any) {
        console.error('❌ ERROR:', error.message);
        console.error('Status:', error.statusCode);
        console.error('Body:', error.body);
        console.error('Headers:', error.headers);

        // Delete if expired
        if (error.statusCode === 410) {
          console.log('🗑️  Deleting expired subscription');
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }

      console.log('');
    }

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testApplePush();

