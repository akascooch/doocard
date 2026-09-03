import { NotificationType } from '@prisma/client';
import { TipAlertService } from './tip-alert.service';
import { SMS_EVENT_KEYS } from './sms-event-keys';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';

describe('TipAlertService', () => {
  const prisma = {
    employee: { findMany: jest.fn() },
    notification: { findFirst: jest.fn() },
  };
  const notifications = { create: jest.fn() };
  const gateway = { sendToUser: jest.fn() };
  const smsOutbound = { sendIfAllowed: jest.fn() };
  const smsTemplates = {
    renderByKey: jest.fn().mockResolvedValue('tip-sms'),
  };

  let service: TipAlertService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TipAlertService(
      prisma as any,
      notifications as any,
      gateway as any,
      smsOutbound as any,
      smsTemplates as any,
    );
  });

  it('exposes TIP_RECEIVED on Prisma NotificationType (schema regression guard)', () => {
    expect(NotificationType.TIP_RECEIVED).toBe('TIP_RECEIVED');
    expect(Object.values(NotificationType)).toContain('TIP_RECEIVED');
  });

  it('sends in-app + SMS after successful path with amount/customer/barber/source', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 7,
        userId: 70,
        user: { id: 70, name: 'Ali', phone: '09120000000' },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);
    const created = {
      id: 1,
      title: 'انعام جدید',
      type: NotificationType.TIP_RECEIVED,
      userIdTarget: 70,
    };
    notifications.create.mockResolvedValue(created);
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: false });

    await service.notifyTipRecipients({
      sourceKey: 'appointment:99',
      sourceLabel: 'تسویه نوبت #99',
      customerName: 'مشتری تست',
      barberName: 'آرایشگر تست',
      allocations: [{ employeeId: 7, amountRial: 50000n }],
    });

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.TIP_RECEIVED,
        userIdTarget: 70,
        relatedEntity: 'tip.alert:appointment:99:emp:7',
        message: expect.stringContaining('تومان'),
      }),
    );
    expect(gateway.sendToUser).toHaveBeenCalledWith(70, created);
    expect(smsTemplates.renderByKey).toHaveBeenCalledWith(
      SMS_TEMPLATE_KEYS.TIP_RECEIVED,
      expect.objectContaining({
        customerName: 'مشتری تست',
        barberName: 'آرایشگر تست',
        source: 'تسویه نوبت #99',
        amount: (5000).toLocaleString('fa-IR'),
      }),
    );
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.TIP_RECEIVED,
        phone: '09120000000',
        dedupeKey: 'tip.alert:appointment:99:emp:7:sms',
        templateKey: SMS_TEMPLATE_KEYS.TIP_RECEIVED,
      }),
    );
  });

  it('still sends SMS when in-app notification create fails (soft-fail)', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 7,
        userId: 70,
        user: { id: 70, name: 'Ali', phone: '09120000000' },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);
    notifications.create.mockRejectedValue(
      new Error('Invalid value for argument `type`. Expected NotificationType.'),
    );
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: false });

    await expect(
      service.notifyTipRecipients({
        sourceKey: 'appointment:100',
        sourceLabel: 'تسویه نوبت #100',
        customerName: 'مشتری',
        barberName: 'آرایشگر',
        allocations: [{ employeeId: 7, amountRial: 25000 }],
      }),
    ).resolves.toBeUndefined();

    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.TIP_RECEIVED }),
    );
    expect(gateway.sendToUser).not.toHaveBeenCalled();
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.TIP_RECEIVED,
        phone: '09120000000',
        dedupeKey: 'tip.alert:appointment:100:emp:7:sms',
      }),
    );
  });

  it('skips duplicate in-app notification when relatedEntity exists', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 7,
        userId: 70,
        user: { id: 70, name: 'Ali', phone: '09120000000' },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue({ id: 9 });
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: true });

    await service.notifyTipRecipients({
      sourceKey: 'manual-tip:3',
      sourceLabel: 'ثبت دستی',
      allocations: [{ employeeId: 7, amountRial: 1000 }],
    });

    expect(notifications.create).not.toHaveBeenCalled();
    expect(gateway.sendToUser).not.toHaveBeenCalled();
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalled();
  });

  it('sends independent in-app + SMS for each TEAM SERVICE allocation', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 7, userId: 70, user: { id: 70, name: 'A', phone: '09120000007' } },
      { id: 8, userId: 80, user: { id: 80, name: 'B', phone: '09120000008' } },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);
    notifications.create.mockImplementation(async (dto: any) => ({
      id: dto.userIdTarget,
      ...dto,
    }));
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true });

    await service.notifyTipRecipients({
      sourceKey: 'appointment:12',
      sourceLabel: 'تسویه نوبت #12',
      allocations: [
        { employeeId: 7, amountRial: 30_000 },
        { employeeId: 8, amountRial: 30_000 },
      ],
    });

    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledTimes(2);
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'tip.alert:appointment:12:emp:7:sms',
        phone: '09120000007',
      }),
    );
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupeKey: 'tip.alert:appointment:12:emp:8:sms',
        phone: '09120000008',
      }),
    );
  });

  it('does not throw when SMS template render fails (non-blocking)', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 7, userId: 70, user: { id: 70, name: 'A', phone: '09120000007' } },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);
    notifications.create.mockResolvedValue({ id: 1, userIdTarget: 70 });
    smsTemplates.renderByKey.mockRejectedValue(new Error('provider/template down'));

    await expect(
      service.notifyTipRecipients({
        sourceKey: 'appointment:13',
        sourceLabel: 'تسویه نوبت #13',
        allocations: [{ employeeId: 7, amountRial: 10_000 }],
      }),
    ).resolves.toBeUndefined();

    expect(notifications.create).toHaveBeenCalled();
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });
});
