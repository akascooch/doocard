import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotificationDto } from './dto';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  private async assertNotificationAccess(notificationId: number, userId: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userIdTarget != null && notification.userIdTarget !== userId) {
      throw new ForbiddenException('Unauthorized notification access');
    }

    if (notification.roleTarget) {
      const requester = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (!requester || requester.role !== (notification.roleTarget as any)) {
        throw new ForbiddenException('Unauthorized notification access');
      }
    }

    return notification;
  }

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

    return notification;
  }

  async findByUser(userId: number, limit: number = 50) {
    return this.prisma.notification.findMany({
      where: { userIdTarget: userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findByRole(role: string, limit: number = 50) {
    return this.prisma.notification.findMany({
      where: { roleTarget: role },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getMyNotifications(userId: number, role: string, limit: number = 50) {
    return this.prisma.notification.findMany({
      where: {
        OR: [{ userIdTarget: userId }, { roleTarget: role }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markAsRead(id: number, userId: number) {
    await this.assertNotificationAccess(id, userId);
    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: number, role: string) {
    return this.prisma.notification.updateMany({
      where: {
        OR: [{ userIdTarget: userId }, { roleTarget: role }],
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(userId: number, role: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        OR: [{ userIdTarget: userId }, { roleTarget: role }],
        isRead: false,
      },
    });
  }

  async remove(id: number, userId: number) {
    await this.assertNotificationAccess(id, userId);
    return this.prisma.notification.delete({ where: { id } });
  }

  async getAdminHistory(limit: number = 100) {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, phone: true, role: true },
        },
      },
    });
  }
}
