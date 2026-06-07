#!/usr/bin/env ts-node
/**
 * Test Push Notification System
 * This script:
 * 1. Checks if push_subscriptions table exists
 * 2. Shows active subscriptions
 * 3. Sends a test push notification to all subscribers
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function testPushSystem() {
  console.log('\n🔔 Testing Push Notification System\n');
  console.log('='.repeat(50));

  try {
    // 1. Check subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      include: { user: { select: { id: true, name: true, phone: true, role: true } } },
    });

    console.log(`\n📊 Found ${subscriptions.length} active subscriptions:\n`);
    
    if (subscriptions.length === 0) {
      console.log('⚠️  No subscriptions found. Users need to subscribe first.');
      await prisma.$disconnect();
      return;
    }

    subscriptions.forEach((sub, index) => {
      console.log(`${index + 1}. ${sub.user.name} (${sub.user.phone}) - ${sub.user.role}`);
      console.log(`   Endpoint: ${sub.endpoint.substring(0, 60)}...`);
      console.log(`   Created: ${sub.createdAt.toLocaleString('fa-IR')}\n`);
    });

    // 2. Configure web-push
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com';

    if (!vapidPublic || !vapidPrivate) {
      console.error('❌ VAPID keys not found in .env');
      await prisma.$disconnect();
      return;
    }

    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    // 3. Send test notification
    console.log('='.repeat(50));
    console.log('\n📤 Sending test push notifications...\n');

    const payload = JSON.stringify({
      title: '🧪 تست سیستم اعلان‌ها',
      body: 'این یک پیام تستی است. اگر این پیام را دیدید، سیستم به درستی کار می‌کند! ✅',
      icon: '/logo/logo-192.png',
      badge: '/logo/logo-192.png',
      data: { 
        url: '/dashboard',
        test: true,
        timestamp: Date.now(),
      },
    });

    const options = {
      TTL: 3600, // 1 hour
      urgency: 'high' as const,
      topic: 'test-notification',
      headers: {
        'apns-topic': 'com.doocard.barbershop',
        'apns-priority': '10',
        'apns-push-type': 'alert',
      },
    };

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        await webpush.sendNotification(pushSub, payload, options);
        console.log(`✅ Sent to ${sub.user.name} (${sub.user.role})`);
        sent++;
      } catch (error: any) {
        console.error(`❌ Failed to send to ${sub.user.name}:`, error.message);
        failed++;

        // Delete expired subscriptions
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`🗑️  Deleting expired subscription for ${sub.user.name}`);
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Test Results:\n');
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${subscriptions.length}`);
    console.log('='.repeat(50));

    if (sent > 0) {
      console.log('\n🎉 Test successful! Check your devices for notifications.');
    } else {
      console.log('\n⚠️  No notifications were sent successfully.');
      console.log('Check:');
      console.log('  1. VAPID keys are correct');
      console.log('  2. Subscriptions are valid');
      console.log('  3. Devices have notification permission');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPushSystem();

