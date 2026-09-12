import { StockWaitlistChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { SmsOutboundService } from '../sms/sms-outbound.service';
import { SmsTemplateService } from '../sms/sms-template.service';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';
import { StockNotificationService } from './stock-notification.service';

describe('StockNotificationService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
    product: { findUnique: jest.fn() },
  };
  const smsOutbound = { sendIfAllowed: jest.fn() };
  const smsTemplates = { renderByKey: jest.fn() };
  const notifications = { create: jest.fn() };
  const gateway = { sendToUser: jest.fn() };

  function makeService() {
    return new StockNotificationService(
      prisma as unknown as PrismaService,
      smsOutbound as unknown as SmsOutboundService,
      smsTemplates as unknown as SmsTemplateService,
      notifications as unknown as NotificationsService,
      gateway as unknown as NotificationsGateway,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    smsTemplates.renderByKey.mockResolvedValue('مشتری گرامی دوکارد، محصول Gel مجدداً موجود شد.');
    prisma.product.findUnique.mockResolvedValue({ name: 'Gel' });
    notifications.create.mockResolvedValue({ id: 1 });
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true });
  });

  it('does not dispatch when stock was already above zero', () => {
    const service = makeService();
    const spy = jest.spyOn(service, 'dispatch').mockResolvedValue(undefined);
    service.notifyIfBackInStock(9, 2, 5);
    expect(spy).not.toHaveBeenCalled();
  });

  it('dispatches when stock moves from 0 to 5', () => {
    const service = makeService();
    const spy = jest.spyOn(service, 'dispatch').mockResolvedValue(undefined);
    service.notifyIfBackInStock(9, 0, 5);
    expect(spy).toHaveBeenCalledWith(9);
  });

  it('claims multiple ACTIVE subscribers and marks them notified via SQL', async () => {
    const rows = [
      { id: 'sub-a', userId: 1, phone: '09121111111', channel: StockWaitlistChannel.SMS },
      { id: 'sub-b', userId: 2, phone: '09122222222', channel: StockWaitlistChannel.SMS },
    ];
    prisma.$queryRaw.mockResolvedValue(rows);
    const service = makeService();
    await service.dispatch(9);
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledTimes(2);
    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.PRODUCT_BACK_IN_STOCK,
        dedupeKey: `${SMS_EVENT_KEYS.PRODUCT_BACK_IN_STOCK}:sub-a`,
        skipAlwaysCc: true,
      }),
    );
  });

  it('does not notify the same subscriber twice under concurrent dispatch', async () => {
    let claimed = false;
    prisma.$queryRaw.mockImplementation(async () => {
      if (claimed) return [];
      claimed = true;
      return [{ id: 'sub-1', userId: 1, phone: '09121234567', channel: StockWaitlistChannel.SMS }];
    });
    const service = makeService();
    await Promise.all([service.dispatch(9), service.dispatch(9)]);
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledTimes(1);
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: `${SMS_EVENT_KEYS.PRODUCT_BACK_IN_STOCK}:sub-1` }),
    );
  });

  it('swallows SMS gateway failures without throwing', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { id: 'sub-1', userId: 1, phone: '09121234567', channel: StockWaitlistChannel.SMS },
    ]);
    smsOutbound.sendIfAllowed.mockRejectedValue(new Error('gateway down'));
    const service = makeService();
    await expect(service.dispatch(9)).resolves.toBeUndefined();
    expect(notifications.create).toHaveBeenCalled();
  });
});
