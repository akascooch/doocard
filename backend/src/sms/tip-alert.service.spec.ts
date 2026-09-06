import { NotificationType } from '@prisma/client';
import { TipAlertService } from './tip-alert.service';

describe('TipAlertService', () => {
  const prisma = {
    employee: { findMany: jest.fn() },
    notification: { findFirst: jest.fn() },
  };
  const notifications = { create: jest.fn() };
  const gateway = { sendToUser: jest.fn() };
  const push = { sendToUser: jest.fn() };

  let service: TipAlertService;

  beforeEach(() => {
    jest.clearAllMocks();
    push.sendToUser.mockResolvedValue({ sent: 1, failed: 0 });
    service = new TipAlertService(
      prisma as any,
      notifications as any,
      gateway as any,
      push as any,
    );
  });

  it('exposes TIP_RECEIVED on Prisma NotificationType (schema regression guard)', () => {
    expect(NotificationType.TIP_RECEIVED).toBe('TIP_RECEIVED');
    expect(Object.values(NotificationType)).toContain('TIP_RECEIVED');
  });

  it('sends in-app + socket + push and never SMS', async () => {
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
    expect(push.sendToUser).toHaveBeenCalledWith(
      70,
      expect.objectContaining({
        title: 'انعام جدید',
        data: expect.objectContaining({ relatedEntity: 'tip.alert:appointment:99:emp:7' }),
      }),
    );
  });

  it('skips duplicate in-app and push when relatedEntity exists', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 7,
        userId: 70,
        user: { id: 70, name: 'Ali', phone: '09120000000' },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue({ id: 9 });

    await service.notifyTipRecipients({
      sourceKey: 'manual-tip:3',
      sourceLabel: 'ثبت دستی',
      allocations: [{ employeeId: 7, amountRial: 1000 }],
    });

    expect(notifications.create).not.toHaveBeenCalled();
    expect(gateway.sendToUser).not.toHaveBeenCalled();
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('sends independent in-app + push for each TEAM SERVICE allocation', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 7, userId: 70, user: { id: 70, name: 'A', phone: '09120000007' } },
      { id: 8, userId: 80, user: { id: 80, name: 'B', phone: '09120000008' } },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);
    notifications.create.mockImplementation(async (dto: any) => ({
      id: dto.userIdTarget,
      ...dto,
    }));

    await service.notifyTipRecipients({
      sourceKey: 'appointment:12',
      sourceLabel: 'تسویه نوبت #12',
      allocations: [
        { employeeId: 7, amountRial: 30_000 },
        { employeeId: 8, amountRial: 30_000 },
      ],
    });

    expect(notifications.create).toHaveBeenCalledTimes(2);
    expect(push.sendToUser).toHaveBeenCalledTimes(2);
  });

  it('does not throw when push fails (non-blocking)', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 7, userId: 70, user: { id: 70, name: 'A', phone: '09120000007' } },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);
    notifications.create.mockResolvedValue({ id: 1, userIdTarget: 70 });
    push.sendToUser.mockRejectedValue(new Error('vapid missing'));

    await expect(
      service.notifyTipRecipients({
        sourceKey: 'appointment:13',
        sourceLabel: 'تسویه نوبت #13',
        allocations: [{ employeeId: 7, amountRial: 10_000 }],
      }),
    ).resolves.toBeUndefined();

    expect(notifications.create).toHaveBeenCalled();
  });
});
