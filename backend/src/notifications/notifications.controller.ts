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
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { CreateNotificationDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PermissionGuard } from '../common/guards/permission.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class NotificationsController {
  constructor(
    private readonly service: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Get my notifications (user-specific + role-based)
   */
  @Get('my')
  async getMyNotifications(@Req() req: any, @Query('limit') limit?: string) {
    const userId = req.user.sub || req.user.id;
    const role = req.user.role;
    const limitNum = limit ? parseInt(limit) : 50;

    return this.service.getMyNotifications(userId, role, limitNum);
  }

  /**
   * Get unread count
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    const role = req.user.role;

    return {
      count: await this.service.getUnreadCount(userId, role),
    };
  }

  /**
   * Mark notification as read
   */
  @Patch(':id/mark-read')
  async markAsRead(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.service.markAsRead(id, userId);
  }

  /**
   * Mark all as read
   */
  @Post('mark-all-read')
  async markAllAsRead(@Req() req: any) {
    const userId = req.user.sub || req.user.id;
    const role = req.user.role;

    return this.service.markAllAsRead(userId, role);
  }

  /**
   * Delete notification
   */
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const userId = req.user.sub || req.user.id;
    return this.service.remove(id, userId);
  }

  /**
   * Create notification (ADMIN only - for manual/broadcast notifications)
   */
  @Post()
  @Roles('ADMIN')
  async create(@Body() dto: CreateNotificationDto) {
    const notification = await this.service.create(dto);

    // Send real-time notification
    if (notification.userIdTarget) {
      this.gateway.sendToUser(notification.userIdTarget, notification);
    } else if (notification.roleTarget) {
      this.gateway.sendToRole(notification.roleTarget, notification);
    } else {
      this.gateway.broadcast(notification);
    }

    return notification;
  }

  /**
   * Broadcast to all (ADMIN only)
   */
  @Post('broadcast')
  @Roles('ADMIN')
  async broadcast(@Body() dto: CreateNotificationDto) {
    const notification = await this.service.create({
      ...dto,
      roleTarget: undefined,
      userIdTarget: undefined,
    });

    this.gateway.broadcast(notification);

    return notification;
  }
}
