import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  describe('getNotifications', () => {
    it('should return empty notifications array', async () => {
      const result = await controller.getNotifications();

      expect(result).toEqual({
        notifications: [],
        unreadCount: 0,
        message: 'Notifications endpoint is working',
      });
    });

    it('should always return the same structure', async () => {
      const result1 = await controller.getNotifications();
      const result2 = await controller.getNotifications();

      expect(result1).toEqual(result2);
      expect(result1).toHaveProperty('notifications');
      expect(result1).toHaveProperty('unreadCount');
      expect(result1).toHaveProperty('message');
    });
  });
});
