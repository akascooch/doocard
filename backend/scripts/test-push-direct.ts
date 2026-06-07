import { PrismaClient } from '@prisma/client';
import * as webpush from 'web-push';

const prisma = new PrismaClient();

async function testPushDirect() {
  try {
    console.log('🧪 Direct Push Notification Test');
    console.log('='.repeat(50));

    // Configure VAPID
    const vapidPublic = process.env.VAPID_PUBLIC_KEY!;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY!;
    const vapidEmail = process.env.VAPID_EMAIL || 'mailto:support@doocardbarbershop.com';

    if (!vapidPublic || !vapidPrivate) {
      console.error('❌ VAPID keys not found in .env');
      process.exit(1);
    }

    webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);
    console.log('✅ VAPID configured');
    console.log('Public key:', vapidPublic.substring(0, 20) + '...');

    // Get all subscriptions
    const subscriptions = await prisma.pushSubscription.findMany({
      include: {
        user: {
          select: { id: true, name: true, phone: true, role: true },
        },
      },
    });

    console.log(`\n📊 Found ${subscriptions.length} subscriptions`);

    if (subscriptions.length === 0) {
      console.log('❌ No subscriptions found!');
      console.log('💡 Please subscribe from the app first.');
      process.exit(1);
    }

    // Show all subscriptions
    subscriptions.forEach((sub, idx) => {
      console.log(`\n${idx + 1}. User: ${sub.user.name} (${sub.user.phone})`);
      console.log(`   Role: ${sub.user.role}`);
      console.log(`   Endpoint: ${sub.endpoint.substring(0, 70)}...`);
      console.log(`   Created: ${sub.createdAt}`);
    });

    // Send test notification to each subscription
    console.log('\n🚀 Sending test notifications...\n');

    const results = await Promise.allSettled(
      subscriptions.map(async (sub, idx) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          const payload = {
            title: '🧪 تست نوتیفیکیشن Doocard',
            body: `سلام ${sub.user.name}! این یک پیام تستی است. اگر دیدید، سیستم کار می‌کند! ✅`,
            icon: 'https://www.doocardbarbershop.com/logo/logo-192.png',
            badge: 'https://www.doocardbarbershop.com/logo/logo-192.png',
            data: {
              url: '/dashboard',
              test: true,
              timestamp: Date.now(),
            },
          };

          // Detect platform
          const isApple = sub.endpoint.includes('web.push.apple.com');
          const isFCM = sub.endpoint.includes('fcm.googleapis.com');
          const platform = isApple ? '🍎 iOS' : isFCM ? '🤖 Android' : '🌐 Generic';

          console.log(`${idx + 1}. Sending to ${platform} - ${sub.user.phone}...`);

          const options: any = {
            TTL: 60 * 60 * 24 * 7,
            urgency: 'high',
          };

          if (isApple) {
            options.topic = 'com.doocardbarbershop.web';
          }

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload),
            options
          );

          console.log(`   ✅ Sent successfully`);
          return { success: true, user: sub.user.phone };
        } catch (error: any) {
          console.log(`   ❌ Failed: ${error.message}`);
          if (error.statusCode) {
            console.log(`   Status: ${error.statusCode}`);
          }
          return { success: false, user: sub.user.phone, error: error.message };
        }
      })
    );

    // Summary
    console.log('\n' + '='.repeat(50));
    const sent = results.filter((r) => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.length - sent;
    
    console.log(`\n📊 Results:`);
    console.log(`   ✅ Sent: ${sent}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📱 Total devices: ${results.length}`);

    if (sent > 0) {
      console.log('\n🎉 Test successful! Check your devices for notifications.');
    } else {
      console.log('\n❌ All sends failed. Check the errors above.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPushDirect();

