import { NotificationType } from '@prisma/client';
import {
  TIP_PUSH_BREAKER_COOLDOWN_MS,
  TIP_PUSH_BREAKER_THRESHOLD,
  TipAlertService,
} from './tip-alert.service';
import { flushFireAndForgetAfterEach } from '../../test/flush-fire-and-forget';

describe('TipAlertService', () => {
  flushFireAndForgetAfterEach();

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

  function threeRecipients() {
    prisma.employee.findMany.mockResolvedValue([
      { id: 7, userId: 70, user: { id: 70, name: 'A', phone: '09120000007' } },
      { id: 8, userId: 80, user: { id: 80, name: 'B', phone: '09120000008' } },
      { id: 9, userId: 90, user: { id: 90, name: 'C', phone: '09120000009' } },
    ]);
    prisma.notification.findFirst.mockResolvedValue(null);
    notifications.create.mockImplementation(async (dto: any) => ({ id: dto.userIdTarget, ...dto }));
    return [
      { employeeId: 7, amountRial: 10_000 },
      { employeeId: 8, amountRial: 10_000 },
      { employeeId: 9, amountRial: 10_000 },
    ];
  }

  it('resolves while push never settles (push is off the caller path)', async () => {
    const allocations = threeRecipients();
    push.sendToUser.mockReturnValue(new Promise(() => undefined));

    const outcome = await Promise.race([
      service
        .notifyTipRecipients({ sourceKey: 'appointment:20', sourceLabel: 't', allocations })
        .then(() => 'done'),
      new Promise((resolve) => setTimeout(() => resolve('blocked'), 500)),
    ]);

    expect(outcome).toBe('done');
    expect(push.sendToUser).toHaveBeenCalledTimes(3);
  });

  it('processes recipients in parallel: all in-app lookups start before any completes', async () => {
    const allocations = threeRecipients();
    const releases: Array<() => void> = [];
    prisma.notification.findFirst.mockImplementation(
      () => new Promise((resolve) => releases.push(() => resolve(null))),
    );

    const run = service.notifyTipRecipients({ sourceKey: 'appointment:21', sourceLabel: 't', allocations });
    for (let i = 0; i < 10 && releases.length < 3; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    expect(releases).toHaveLength(3);
    expect(notifications.create).not.toHaveBeenCalled();
    releases.forEach((release) => release());
    await run;
    expect(notifications.create).toHaveBeenCalledTimes(3);
    expect(push.sendToUser).toHaveBeenCalledTimes(3);
  });

  it('opens the push breaker after consecutive failures but keeps in-app alerts', async () => {
    push.sendToUser.mockRejectedValue(new Error('Socket timeout'));
    for (let i = 0; i < TIP_PUSH_BREAKER_THRESHOLD; i += 1) {
      prisma.employee.findMany.mockResolvedValue([
        { id: 7, userId: 70, user: { id: 70, name: 'A', phone: '09120000007' } },
      ]);
      prisma.notification.findFirst.mockResolvedValue(null);
      notifications.create.mockResolvedValue({ id: i, userIdTarget: 70 });
      await service.notifyTipRecipients({
        sourceKey: `appointment:${30 + i}`,
        sourceLabel: 't',
        allocations: [{ employeeId: 7, amountRial: 10_000 }],
      });
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(service.isPushBreakerOpen()).toBe(true);

    push.sendToUser.mockClear();
    notifications.create.mockClear();
    await service.notifyTipRecipients({
      sourceKey: 'appointment:99',
      sourceLabel: 't',
      allocations: [{ employeeId: 7, amountRial: 10_000 }],
    });
    expect(notifications.create).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).not.toHaveBeenCalled();
    expect(service.isPushBreakerOpen(Date.now() + TIP_PUSH_BREAKER_COOLDOWN_MS + 1)).toBe(false);
  });

  it('suppresses push for the whole 60s cooldown and resumes after it', async () => {
    const t0 = 1_800_000_000_000;
    const clock = jest.spyOn(Date, 'now').mockReturnValue(t0);
    try {
      prisma.employee.findMany.mockResolvedValue([
        { id: 7, userId: 70, user: { id: 70, name: 'A', phone: '09120000007' } },
      ]);
      prisma.notification.findFirst.mockResolvedValue(null);
      notifications.create.mockResolvedValue({ id: 1, userIdTarget: 70 });
      push.sendToUser.mockRejectedValue(new Error('Socket timeout'));
      const notify = (n: number) =>
        service.notifyTipRecipients({
          sourceKey: `appointment:${200 + n}`,
          sourceLabel: 't',
          allocations: [{ employeeId: 7, amountRial: 10_000 }],
        });

      for (let i = 0; i < TIP_PUSH_BREAKER_THRESHOLD; i += 1) {
        await notify(i);
        await new Promise((resolve) => setImmediate(resolve));
      }
      expect(push.sendToUser).toHaveBeenCalledTimes(TIP_PUSH_BREAKER_THRESHOLD);

      push.sendToUser.mockClear();
      push.sendToUser.mockResolvedValue({ sent: 1, failed: 0 });
      clock.mockReturnValue(t0 + TIP_PUSH_BREAKER_COOLDOWN_MS - 1);
      await notify(10);
      expect(push.sendToUser).not.toHaveBeenCalled();

      clock.mockReturnValue(t0 + TIP_PUSH_BREAKER_COOLDOWN_MS + 1);
      await notify(11);
      expect(push.sendToUser).toHaveBeenCalledTimes(1);
      expect(notifications.create).toHaveBeenCalledTimes(TIP_PUSH_BREAKER_THRESHOLD + 2);
    } finally {
      clock.mockRestore();
    }
  });
});
