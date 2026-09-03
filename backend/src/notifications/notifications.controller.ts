import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  Query,
  Logger,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';
import { PrismaService } from '../prisma/prisma.service';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';
import { SMS_TEMPLATE_KEYS } from '../sms/sms-template.catalog';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly service: NotificationsService,
    private readonly gateway: NotificationsGateway,
    private readonly prisma: PrismaService,
    private readonly smsOutbound: SmsOutboundService,
  ) {}

  @Get('my')
  async getMyNotifications(@Req() req: any, @Query('limit') limit?: string) {
    const userId = req.user.sub || req.user.id;
    const role = req.user.role;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.service.getMyNotifications(userId, role, limitNum);
  }

  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    const role = req.user.role;

    return {
      count: await this.service.getUnreadCount(userId, role),
    };
  }

  @Patch(':id/mark-read')
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.service.markAsRead(id, userId);
  }

  @Post('mark-all-read')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    const role = req.user.role;

    return this.service.markAllAsRead(userId, role);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.service.remove(id, userId);
  }

  @Get('admin/history')
  @Roles('ADMIN')
  async getAdminHistory(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    return this.service.getAdminHistory(Number.isFinite(limitNum) ? limitNum : 100);
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateNotificationDto) {
    const notification = await this.service.create(dto);

    if (notification.userIdTarget) {
      this.gateway.sendToUser(notification.userIdTarget, notification);
    } else if (notification.roleTarget) {
      this.gateway.sendToRole(notification.roleTarget, notification);
    } else {
      this.gateway.broadcast(notification);
    }

    if (dto.sendSms) {
      await this.trySendSms(notification);
    }

    return notification;
  }

  @Post('broadcast')
  @Roles('ADMIN')
  async broadcast(@Body() dto: CreateNotificationDto) {
    const notification = await this.service.create({
      ...dto,
      roleTarget: undefined,
      userIdTarget: undefined,
    });

    this.gateway.broadcast(notification);

    if (dto.sendSms) {
      await this.trySendSms(notification);
    }

    return notification;
  }

  /** Soft-fail SMS for manual notifications; gated by policy notification.created */
  private async trySendSms(notification: {
    id: number;
    title: string;
    message: string;
    userIdTarget?: number | null;
    roleTarget?: string | null;
    user?: { id: number; phone: string | null } | null;
  }) {
    try {
      const smsBody = `${notification.title}\n${notification.message}`.slice(0, 280);
      const recipients: { id: number; phone: string }[] = [];

      if (notification.userIdTarget && notification.user?.phone) {
        recipients.push({ id: notification.user.id, phone: notification.user.phone });
      } else if (notification.roleTarget) {
        const users = await this.prisma.user.findMany({
          where: { role: notification.roleTarget as any, phone: { not: null } },
          select: { id: true, phone: true },
          take: 100,
        });
        for (const u of users) {
          if (u.phone) recipients.push({ id: u.id, phone: u.phone });
        }
      }

      for (const r of recipients) {
        await this.smsOutbound.sendIfAllowed({
          eventKey: SMS_EVENT_KEYS.NOTIFICATION_CREATED,
          phone: r.phone,
          message: smsBody,
          dedupeKey: `notification.created:${notification.id}:${r.id}`,
          templateKey: SMS_TEMPLATE_KEYS.AD_HOC_NOTIFICATION,
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `Notification SMS soft-fail id=${notification.id}: ${err?.message || 'unknown'}`,
      );
    }
  }
}
