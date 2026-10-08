import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import {
  PUSH_HTTP_TIMEOUT_MS,
  PushNotificationsService,
  assertPushTransportAllowed,
} from './push-notifications.service';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({}),
}));

describe('push delivery isolation', () => {
  const prisma = {
    pushSubscription: { findMany: jest.fn(), delete: jest.fn() },
    user: { findMany: jest.fn() },
  } as unknown as PrismaService;

  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('bounds every provider call with a socket timeout', async () => {
    delete process.env.DOOCARD_PUSH_TRANSPORT;
    process.env.NODE_ENV = 'test';
    prisma.pushSubscription.findMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        p256dh: 'key',
        auth: 'auth',
      },
    ]);
    const service = new PushNotificationsService(prisma);
    await service.sendToUser(4, { title: 't', body: 'b' });
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(String),
      expect.objectContaining({ timeout: PUSH_HTTP_TIMEOUT_MS }),
    );
  });

  it('does not contact a push provider when the test transport is disabled', async () => {
    process.env.DOOCARD_PUSH_TRANSPORT = 'disabled';
    process.env.NODE_ENV = 'test';
    prisma.pushSubscription.findMany = jest.fn().mockResolvedValue([
      {
        id: 1,
        endpoint: 'https://web.push.apple.com/abc',
        p256dh: 'key',
        auth: 'auth',
      },
    ]);
    const service = new PushNotificationsService(prisma);
    const result = await service.sendToUser(4, { title: 't', body: 'b' });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: 1, failed: 0 });
  });

  it('refuses the disabled transport in production', () => {
    process.env.DOOCARD_PUSH_TRANSPORT = 'disabled';
    process.env.NODE_ENV = 'production';
    expect(() => assertPushTransportAllowed()).toThrow(/refused/);
    expect(() => new PushNotificationsService(prisma)).toThrow(/refused/);
  });
});
