#!/usr/bin/env ts-node
/**
 * Send test push to specific user by phone
 * Usage: npx ts-node scripts/send-test-to-user.ts 09304013878
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function sendTestToUser() {
  const phone = process.argv[2] || '09304013878';
  
  console.log(`\n🔔 Sending test push to phone: ${phone}\n`);

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { phone },
      include: { pushSubscriptions: true },
    });

    if (!user) {
      console.log('❌ User not found');
      await prisma.$disconnect();
      return;
    }

    console.log(`✅ Found user: ${user.name} (${user.role})`);
    console.log(`📊 Subscriptions: ${user.pushSubscriptions.length}\n`);

    if (user.pushSubscriptions.length === 0) {
      console.log('⚠️ No subscriptions found. User needs to subscribe first.');
      await prisma.$disconnect();
      return;
    }

    // Configure webpush
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Send to each subscription
    let sent = 0;
    let failed = 0;

    for (const sub of user.pushSubscriptions) {
      const isApple = sub.endpoint.includes('apple');
      const isFCM = sub.endpoint.includes('fcm.googleapis');
      
      console.log(`\nTrying: ${isApple ? '🍎 Apple' : isFCM ? '🤖 FCM' : '🌐 Generic'}`);
      console.log(`Endpoint: ${sub.endpoint.substring(0, 60)}...`);

      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      const payload = JSON.stringify({
        title: '🧪 تست از سرور',
        body: `سلام ${user.name}! این یک پیام تستی است. اگر این را دیدید، سیستم کامل کار می‌کند! ✅`,
        icon: 'https://www.doocardbarbershop.com/logo/logo-192.png',
        badge: 'https://www.doocardbarbershop.com/logo/logo-192.png',
        data: { 
          url: '/dashboard',
          test: true,
          timestamp: Date.now(),
        },
      });

      const options: any = {
        TTL: 3600,
        urgency: 'high',
      };

      if (isApple) {
        options.topic = 'www.doocardbarbershop.com';
        options.headers = {
          'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600),
          'apns-priority': '10',
          'apns-push-type': 'alert',
          'apns-topic': 'www.doocardbarbershop.com',
        };
      } else {
        options.topic = 'doocard-test';
      }

      try {
        const result = await webpush.sendNotification(pushSub, payload, options);
        console.log(`✅ SUCCESS - Status: ${result.statusCode}`);
        sent++;
      } catch (error: any) {
        console.error(`❌ FAILED - ${error.message}`);
        console.error(`Status Code: ${error.statusCode}`);
        if (error.body) console.error(`Body: ${error.body}`);
        failed++;

        // Delete if expired
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log('🗑️ Deleting expired subscription');
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Results: ✅ ${sent} sent, ❌ ${failed} failed`);
    console.log('='.repeat(50));

    if (sent > 0) {
      console.log('\n🎉 لطفاً دستگاه خود را چک کنید!');
      console.log('نوتیفیکیشن باید در 5-10 ثانیه آینده نمایش داده شود.');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

sendTestToUser();

