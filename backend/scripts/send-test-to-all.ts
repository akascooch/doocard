#!/usr/bin/env ts-node
/**
 * Send test push notification to ALL active subscriptions
 * This will test iOS, Android, Windows - everything
 */

import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function sendTestToAll() {
  console.log('\n📤 Sending test push to ALL subscriptions\n');
  console.log('='.repeat(60));

  try {
    // Configure webpush
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    // Get all subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      include: {
        user: {
          select: { id: true, name: true, phone: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`\n📊 Found ${subscriptions.length} total subscriptions\n`);

    if (subscriptions.length === 0) {
      console.log('⚠️ No subscriptions found!');
      await prisma.$disconnect();
      return;
    }

    // Group by user
    const byUser = new Map<string, any[]>();
    subscriptions.forEach(sub => {
      const key = `${sub.user.name} (${sub.user.phone})`;
      if (!byUser.has(key)) {
        byUser.set(key, []);
      }
      byUser.get(key)!.push(sub);
    });

    console.log('👥 Users with subscriptions:\n');
    byUser.forEach((subs, userName) => {
      console.log(`  ${userName}: ${subs.length} device(s)`);
    });
    console.log('\n' + '='.repeat(60));

    // Send test notification
    const payload = JSON.stringify({
      title: '🧪 تست سیستم اعلان‌ها',
      body: 'این یک پیام تستی است برای همه دستگاه‌ها (iOS, Android, Windows). اگر این را دیدید، سیستم کامل کار می‌کند! ✅',
      icon: 'https://www.doocardbarbershop.com/logo/logo-192.png',
      badge: 'https://www.doocardbarbershop.com/logo/logo-192.png',
      data: { 
        url: '/dashboard',
        test: true,
        timestamp: Date.now(),
      },
    });

    let totalSent = 0;
    let totalFailed = 0;
    const results: any[] = [];

    console.log('\n📤 Sending notifications...\n');

    for (const sub of subscriptions) {
      const isApple = sub.endpoint.includes('apple');
      const isFCM = sub.endpoint.includes('fcm.googleapis');
      const platform = isApple ? '🍎 iOS' : isFCM ? '🤖 Android' : '🌐 Other';

      const pushSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      const options: any = {};

      if (isApple) {
        // Apple: Use minimal options - NO topic, NO headers
        // Any extra options cause "Unsupported characters" error
      } else {
        // FCM/Other: Can use extra options
        options.TTL = 3600;
        options.urgency = 'high';
      }

      try {
        await webpush.sendNotification(pushSub, payload, options);
        console.log(`✅ ${platform} ${sub.user.name} (${sub.user.role})`);
        totalSent++;
        
        results.push({
          user: sub.user.name,
          phone: sub.user.phone,
          platform,
          status: 'SUCCESS',
        });
      } catch (error: any) {
        console.error(`❌ ${platform} ${sub.user.name}: ${error.message}`);
        totalFailed++;
        
        results.push({
          user: sub.user.name,
          phone: sub.user.phone,
          platform,
          status: 'FAILED',
          error: error.message,
          statusCode: error.statusCode,
        });

        // Delete if expired
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`   🗑️ Deleting expired subscription`);
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Final Results:\n');
    console.log(`✅ Sent: ${totalSent}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`📊 Total: ${subscriptions.length}`);
    console.log(`🎯 Success Rate: ${Math.round((totalSent / subscriptions.length) * 100)}%`);
    console.log('='.repeat(60));

    // Show results by platform
    const byPlatform = {
      ios: results.filter(r => r.platform.includes('iOS')),
      android: results.filter(r => r.platform.includes('Android')),
      other: results.filter(r => r.platform.includes('Other')),
    };

    console.log('\n📱 Results by Platform:\n');
    console.log(`🍎 iOS:     ${byPlatform.ios.filter(r => r.status === 'SUCCESS').length}/${byPlatform.ios.length} successful`);
    console.log(`🤖 Android: ${byPlatform.android.filter(r => r.status === 'SUCCESS').length}/${byPlatform.android.length} successful`);
    console.log(`🌐 Other:   ${byPlatform.other.filter(r => r.status === 'SUCCESS').length}/${byPlatform.other.length} successful`);

    // Show failed details
    const failed = results.filter(r => r.status === 'FAILED');
    if (failed.length > 0) {
      console.log('\n❌ Failed subscriptions:\n');
      failed.forEach(f => {
        console.log(`  ${f.platform} ${f.user} (${f.phone})`);
        console.log(`    Error: ${f.error}`);
        console.log(`    Code: ${f.statusCode || 'N/A'}\n`);
      });
    }

    if (totalSent > 0) {
      console.log('\n🎉 SUCCESS! Notifications sent to devices.');
      console.log('⏳ Please check all devices in the next 10-30 seconds.');
      console.log('\nDevices that should receive notification:');
      results.filter(r => r.status === 'SUCCESS').forEach(r => {
        console.log(`  ✅ ${r.user} - ${r.platform}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Fatal Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

sendTestToAll();

