import { Controller, Post, Delete, Get, Body, Req, UseGuards, Param } from '@nestjs/common';
import { PushNotificationsService } from './push-notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface SubscribeDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface UnsubscribeDto {
  endpoint: string;
}

interface DeviceLogDto {
  level: string;
  message: string;
  data?: any;
  userAgent?: string;
  platform?: string;
}

@Controller('push-notifications')
export class PushNotificationsController {
  constructor(private readonly service: PushNotificationsService) {}

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(@Body() dto: SubscribeDto, @Req() req: any) {
    console.log('📥 Push subscription request from userId:', req.user.id);
    console.log('Endpoint:', dto.endpoint.substring(0, 60) + '...');
    
    // Save as-is (URL-safe Base64 format)
    // web-push library handles the conversion internally
    const result = await this.service.subscribe(req.user.id, dto);
    console.log('✅ Subscription saved:', result.id);
    
    return { success: true, subscriptionId: result.id };
  }

  @Delete('unsubscribe')
  @UseGuards(JwtAuthGuard)
  async unsubscribe(@Body() dto: UnsubscribeDto, @Req() req: any) {
    console.log('🗑️  Push unsubscribe request from user:', req.user.id);
    return this.service.unsubscribe(req.user.id, dto.endpoint);
  }

  @Get('public-key')
  getPublicKey() {
    const publicKey = this.service.getPublicKey();
    console.log('🔑 VAPID public key requested');
    return { publicKey };
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async sendTest(@Req() req: any) {
    console.log('🧪 Test notification request from userId:', req.user.id);
    
    await this.service.sendToUser(req.user.id, {
      title: '🧪 تست نوتیفیکیشن',
      body: 'این یک پیام تستی است. اگر این را دیدید، سیستم کار می‌کند! ✅',
      icon: '/logo/logo-512.png',
      data: { url: '/dashboard', test: true },
    });
    
    console.log('✅ Test notification sent');
    return { success: true, message: 'Test notification sent' };
  }

  @Get('my-subscriptions')
  @UseGuards(JwtAuthGuard)
  async getMySubscriptions(@Req() req: any) {
    const subscriptions = await this.service.getUserSubscriptions(req.user.id);
    return { subscriptions };
  }

  /**
   * Endpoint to receive logs from devices (for debugging)
   */
  @Post('device-log')
  async logFromDevice(@Body() dto: DeviceLogDto) {
    const timestamp = new Date().toLocaleString('fa-IR');
    console.log(`\n📱 [DEVICE LOG] [${timestamp}] [${dto.level}]`);
    console.log(`Platform: ${dto.platform || 'unknown'}`);
    console.log(`UserAgent: ${dto.userAgent || 'unknown'}`);
    console.log(`Message: ${dto.message}`);
    if (dto.data) {
      console.log(`Data:`, JSON.stringify(dto.data, null, 2));
    }
    console.log('');
    
    return { success: true };
  }

  /**
   * Admin: Send push to a specific user
   */
  @Post('admin/send-to-user')
  @UseGuards(JwtAuthGuard)
  async sendToUser(@Body() dto: { userId: number; title: string; body: string; url?: string }, @Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }

    return this.service.sendToUser(dto.userId, {
      title: dto.title,
      body: dto.body,
      icon: '/logo/logo-512.png',
      data: { url: dto.url || '/dashboard' },
    });
  }

  /**
   * Admin: Get all subscriptions
   */
  @Get('admin/all')
  @UseGuards(JwtAuthGuard)
  async getAllSubscriptions(@Req() req: any) {
    // Only admins can see all subscriptions
    if (req.user.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }
    
    const subscriptions = await this.service.getAllSubscriptions();
    return { subscriptions };
  }

  /**
   * Admin: Send test to role
   */
  @Post('admin/test-role')
  @UseGuards(JwtAuthGuard)
  async testRole(@Body() dto: any, @Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }
    
    console.log(`🧪 Admin test: Sending to role ${dto.role}`);
    
    const result = await this.service.sendToRole(dto.role, {
      title: dto.title || '🧪 تست ادمین',
      body: dto.body || 'پیام تستی از ادمین',
      url: dto.url || '/dashboard',
    });
    
    return result;
  }

  /**
   * Admin: Broadcast to all
   */
  @Post('admin/broadcast')
  @UseGuards(JwtAuthGuard)
  async broadcast(@Body() dto: any, @Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }
    
    console.log('🧪 Admin broadcast test');
    
    const result = await this.service.broadcast({
      title: dto.title || '📢 پیام عمومی',
      body: dto.body || 'پیام برای همه کاربران',
      url: dto.url || '/dashboard',
    });
    
    return result;
  }

  /**
   * Admin: Cleanup invalid subscriptions
   */
  @Post('admin/cleanup')
  @UseGuards(JwtAuthGuard)
  async cleanup(@Req() req: any) {
    if (req.user.role !== 'ADMIN') {
      throw new Error('Unauthorized');
    }
    
    console.log('🧹 Admin: Cleaning up invalid subscriptions');
    
    // Test all subscriptions and remove invalid ones
    const subscriptions = await this.service.getAllSubscriptions();
    let deleted = 0;
    
    for (const sub of subscriptions) {
      try {
        // Try to send a silent test
        await this.service['sendNotification'](sub, {
          title: 'Test',
          body: 'Silent test',
        });
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404 || error.statusCode === 400) {
          deleted++;
        }
      }
    }
    
    return { deleted, message: `${deleted} invalid subscriptions removed` };
  }
}


