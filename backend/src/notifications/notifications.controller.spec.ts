import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { SmsOutboundService } from '../sms/sms-outbound.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockNotifications = [{ id: 1, title: 'test', isRead: false }];
  const mockService = {
    getMyNotifications: jest.fn().mockResolvedValue(mockNotifications),
    getUnreadCount: jest.fn().mockResolvedValue(2),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockService },
        { provide: NotificationsGateway, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: SmsOutboundService, useValue: {} },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    jest.clearAllMocks();
    mockService.getMyNotifications.mockResolvedValue(mockNotifications);
  });

  describe('getMyNotifications', () => {
    it('returns notifications for the authenticated user', async () => {
      const result = await controller.getMyNotifications(
        { user: { id: 9, role: 'CUSTOMER' } },
        '20',
      );

      expect(result).toEqual(mockNotifications);
      expect(mockService.getMyNotifications).toHaveBeenCalledWith(9, 'CUSTOMER', 20);
    });

    it('uses sub when id is absent and defaults the limit', async () => {
      const result = await controller.getMyNotifications({
        user: { sub: 4, role: 'ADMIN' },
      });

      expect(result).toEqual(mockNotifications);
      expect(mockService.getMyNotifications).toHaveBeenCalledWith(4, 'ADMIN', 50);
    });
  });
});
