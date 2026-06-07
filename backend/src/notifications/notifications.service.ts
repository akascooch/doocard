import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a notification
   */
  async create(dto: CreateNotificationDto) {
    const notification = await this.prisma.notification.create({
      data: {
        title: dto.title,
        message: dto.message,
        type: dto.type as any,
        roleTarget: dto.roleTarget,
        userIdTarget: dto.userIdTarget,
        relatedEntity: dto.relatedEntity,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            role: true,
          },
        },
      },
    });

    console.log('📢 Notification created:', notification);
    return notification;
  }

  /**
   * Get notifications for a specific user
   */
  async findByUser(userId: number, limit: number = 50) {
    return this.prisma.notification.findMany({
      where: {
        userIdTarget: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get notifications for a role (broadcast)
   */
  async findByRole(role: string, limit: number = 50) {
    return this.prisma.notification.findMany({
      where: {
        roleTarget: role,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get my notifications (user-specific + role-based)
   */
  async getMyNotifications(userId: number, role: string, limit: number = 50) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        OR: [
          { userIdTarget: userId },
          { roleTarget: role },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return notifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: number, userId: number) {
    // Verify ownership
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    // User can only mark their own notifications or role-based notifications
    if (notification.userIdTarget && notification.userIdTarget !== userId) {
      throw new Error('Unauthorized');
    }

    return this.prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number, role: string) {
    return this.prisma.notification.updateMany({
      where: {
        OR: [
          { userIdTarget: userId },
          { roleTarget: role },
        ],
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: number, role: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        OR: [
          { userIdTarget: userId },
          { roleTarget: role },
        ],
        isRead: false,
      },
    });
  }

  /**
   * Delete a notification
   */
  async remove(id: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userIdTarget && notification.userIdTarget !== userId) {
      throw new Error('Unauthorized');
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }
}

