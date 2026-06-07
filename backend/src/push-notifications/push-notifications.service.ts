import { Injectable, Logger } from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  url?: string;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(private readonly prisma: PrismaService) {
    // Configure web-push with VAPID keys
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@doocardbarbershop.com';
    const vapidPublic = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublic || !vapidPrivate) {
      this.logger.error('❌ VAPID keys not configured! Push notifications will not work.');
      this.logger.error('Please set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in .env');
    } else {
      webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
      this.logger.log('✅ Web Push configured with VAPID keys');
    }
  }

  /**
   * Subscribe a user to push notifications
   */
  async subscribe(userId: number, subscription: PushSubscription) {
    try {
      this.logger.log(`📥 New subscription for user ${userId}`);
      this.logger.log(`Endpoint: ${subscription.endpoint.substring(0, 60)}...`);

      // Check if subscription already exists
      const existing = await this.prisma.pushSubscription.findFirst({
        where: { userId, endpoint: subscription.endpoint },
      });

      if (existing) {
        // Update existing subscription
        this.logger.log(`♻️ Updating existing subscription ${existing.id}`);
        return await this.prisma.pushSubscription.update({
          where: { id: existing.id },
          data: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            updatedAt: new Date(),
          },
        });
      }

      // Create new subscription
      const created = await this.prisma.pushSubscription.create({
        data: {
          userId,
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      });

      this.logger.log(`✅ Subscription created: ${created.id}`);
      return created;
    } catch (error) {
      this.logger.error('❌ Error subscribing to push notifications', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(userId: number, endpoint: string) {
    try {
      const result = await this.prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
      this.logger.log(`🗑️ Deleted ${result.count} subscriptions`);
      return { success: true };
    } catch (error) {
      this.logger.error('Error unsubscribing', error);
      throw error;
    }
  }

  /**
   * Get user's subscriptions
   */
  async getUserSubscriptions(userId: number) {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
      });

      return subscriptions.map(sub => ({
        id: sub.id,
        endpoint: sub.endpoint.substring(0, 60) + '...',
        createdAt: sub.createdAt,
      }));
    } catch (error) {
      this.logger.error('Error getting user subscriptions', error);
      return [];
    }
  }

  /**
   * Send notification to all subscribed users
   */
  async broadcast(payload: NotificationPayload) {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany();

      if (subscriptions.length === 0) {
        this.logger.warn('No subscriptions found');
        return { sent: 0, failed: 0 };
      }

      this.logger.log(`📤 Broadcasting to ${subscriptions.length} subscriptions`);

      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.sendNotification(sub, payload)),
      );

      const sent = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(`✅ Sent: ${sent}, ❌ Failed: ${failed}`);

      return { sent, failed };
    } catch (error) {
      this.logger.error('Error broadcasting notification', error);
      throw error;
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendToUser(userId: number, payload: NotificationPayload) {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId },
      });

      if (subscriptions.length === 0) {
        this.logger.warn(`No subscriptions found for user ${userId}`);
        return { sent: 0, failed: 0 };
      }

      this.logger.log(`📤 Sending to user ${userId} (${subscriptions.length} devices)`);

      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.sendNotification(sub, payload)),
      );

      const sent = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(`User ${userId}: Sent ${sent}, Failed ${failed}`);

      return { sent, failed };
    } catch (error) {
      this.logger.error(`Error sending notification to user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Send notification to users with specific role
   */
  async sendToRole(role: string, payload: NotificationPayload) {
    try {
      const users = await this.prisma.user.findMany({
        where: { role: role as any },
        include: { pushSubscriptions: true },
      });

      const subscriptions = users.flatMap((user) => user.pushSubscriptions);

      if (subscriptions.length === 0) {
        this.logger.warn(`No subscriptions found for role ${role}`);
        return { sent: 0, failed: 0 };
      }

      this.logger.log(`📤 Sending to role ${role} (${subscriptions.length} devices)`);

      const results = await Promise.allSettled(
        subscriptions.map((sub) => this.sendNotification(sub, payload)),
      );

      const sent = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      this.logger.log(`Role ${role}: Sent ${sent}, Failed ${failed}`);

      return { sent, failed };
    } catch (error) {
      this.logger.error(`Error sending notification to role ${role}`, error);
      throw error;
    }
  }

  /**
   * Private method to send notification to a single subscription with retry logic
   */
  private async sendNotification(subscription: any, payload: NotificationPayload, retryCount: number = 0) {
    const MAX_RETRIES = 2;
    
    try {
      const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      // Prepare notification payload
      const notificationPayload = {
        title: payload.title,
        body: payload.body,
        icon: payload.icon || 'https://www.doocardbarbershop.com/logo/logo-192.png',
        badge: payload.badge || 'https://www.doocardbarbershop.com/logo/logo-192.png',
        data: {
          url: payload.url || '/dashboard',
          timestamp: Date.now(),
          ...payload.data,
        },
      };

      // Detect push service provider
      const isApplePush = subscription.endpoint.includes('web.push.apple.com');
      const isFCM = subscription.endpoint.includes('fcm.googleapis.com');
      const isMozilla = subscription.endpoint.includes('mozilla.com');
      
      // Configure options based on provider
      const options: any = {
        TTL: 60 * 60 * 24 * 7, // 7 days
      };

      if (isApplePush) {
        // iOS Safari: Minimal options, high urgency
        options.urgency = 'high';
        options.topic = 'com.doocardbarbershop.web'; // Apple requires topic
        this.logger.log(`🍎 Sending to Apple Push (iOS Safari)`);
      } else if (isFCM) {
        // Android Chrome/Firefox: Full features
        options.urgency = 'high';
        options.TTL = 60 * 60 * 24 * 7;
        this.logger.log(`🤖 Sending to FCM (Android Chrome)`);
      } else if (isMozilla) {
        options.urgency = 'high';
        this.logger.log(`🦊 Sending to Mozilla Push (Firefox)`);
      } else {
        options.urgency = 'high';
        this.logger.log(`🌐 Sending to generic push service`);
      }

      // Send notification
      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify(notificationPayload),
        options
      );

      this.logger.log(`✅ Push sent successfully to ${isApplePush ? 'iOS' : isFCM ? 'Android' : 'other'}`);
      
      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ Push failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}): ${error.message}`);
      
      // Retry on network errors
      if (retryCount < MAX_RETRIES && (error.statusCode === 408 || error.statusCode === 502 || error.statusCode === 503 || error.statusCode === 504)) {
        this.logger.log(`🔄 Retrying in ${(retryCount + 1) * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
        return this.sendNotification(subscription, payload, retryCount + 1);
      }

      // Delete invalid/expired subscriptions
      if (error.statusCode === 410 || error.statusCode === 404 || error.statusCode === 400) {
        this.logger.warn(`🗑️ Deleting invalid subscription ${subscription.id}`);
        try {
          await this.prisma.pushSubscription.delete({
            where: { id: subscription.id },
          });
        } catch (deleteError) {
          this.logger.error(`Failed to delete subscription: ${deleteError.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get VAPID public key (for frontend)
   */
  getPublicKey() {
    return process.env.VAPID_PUBLIC_KEY;
  }

  /**
   * Debug: Get all subscriptions
   */
  async getAllSubscriptions() {
    return await this.prisma.pushSubscription.findMany({
      include: {
        user: {
          select: { id: true, name: true, phone: true, role: true },
        },
      },
    });
  }
}

