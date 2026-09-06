import { NotificationType } from '@prisma/client';
import { ReconcileReminderService } from './reconcile-reminder.service';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';
import { SMS_TEMPLATE_KEYS } from '../sms/sms-template.catalog';

describe('ReconcileReminderService', () => {
  const prisma = {
    employee: { findMany: jest.fn() },
    notification: { findFirst: jest.fn() },
  };
  const notifications = { create: jest.fn() };
  const gateway = { sendToUser: jest.fn() };
  const smsOutbound = { sendIfAllowed: jest.fn() };
  const smsTemplates = {
    renderByKey: jest.fn().mockResolvedValue('سلام علی، لطفاً حساب امروز خود را بررسی و تسویه کنید — دوکارد'),
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'RECONCILE_REMINDER_ENABLED') return 'true';
      if (key === 'RECONCILE_REMINDER_DRY_RUN') return 'false';
      return fallback;
    }),
  };

  let service: ReconcileReminderService;

  beforeEach(() => {
    jest.clearAllMocks();
    config.get.mockImplementation((key: string, fallback?: string) => {
      if (key === 'RECONCILE_REMINDER_ENABLED') return 'true';
      if (key === 'RECONCILE_REMINDER_DRY_RUN') return 'false';
      return fallback;
    });
    service = new ReconcileReminderService(
      config as any,
      prisma as any,
      notifications as any,
      gateway as any,
      smsOutbound as any,
      smsTemplates as any,
    );
  });

  it('exposes ACCOUNT_RECONCILE_REMINDER on Prisma NotificationType', () => {
    expect(NotificationType.ACCOUNT_RECONCILE_REMINDER).toBe(
      'ACCOUNT_RECONCILE_REMINDER',
    );
  });

  it('builds Tehran-dated dedupe keys for EMPLOYEE and SERVICE only', async () => {
    const now = new Date('2026-09-06T10:00:00+03:30');
    const ymd = ReconcileReminderService.todayYmdTehran(now);
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 10,
        user: { id: 10, name: 'علی', phone: '09120000001', role: 'EMPLOYEE' },
      },
      {
        id: 2,
        userId: 20,
        user: { id: 20, name: 'سارا', phone: '09120000002', role: 'SERVICE' },
      },
      {
        id: 3,
        userId: 30,
        user: { id: 30, name: 'ادمین', phone: '09120000003', role: 'ADMIN' },
      },
    ]);

    const plan = await service.buildPlan('13', now);
    expect(plan).toHaveLength(2);
    expect(plan[0].dedupeKey).toBe(`reconcile:13:${ymd}:10`);
    expect(plan[1].dedupeKey).toBe(`reconcile:13:${ymd}:20`);
    expect(smsTemplates.renderByKey).toHaveBeenCalledWith(
      SMS_TEMPLATE_KEYS.ACCOUNT_RECONCILE_REMINDER,
      expect.objectContaining({ name: 'علی' }),
    );
  });

  it('dryRun does not create notifications or send SMS', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 10,
        user: { id: 10, name: 'علی', phone: '09120000001', role: 'EMPLOYEE' },
      },
    ]);
    const result = await service.runSlot('20', {
      now: new Date('2026-09-06T20:00:00+03:30'),
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.planned).toBe(1);
    expect(notifications.create).not.toHaveBeenCalled();
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('skips duplicate in-app on second run and still uses SMS dedupe', async () => {
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 1,
        userId: 10,
        user: { id: 10, name: 'علی', phone: '09120000001', role: 'EMPLOYEE' },
      },
    ]);
    prisma.notification.findFirst.mockResolvedValue({ id: 99 });
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: true });

    const result = await service.runSlot('13', {
      now: new Date('2026-09-06T13:00:00+03:30'),
    });
    expect(notifications.create).not.toHaveBeenCalled();
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.ACCOUNT_RECONCILE_REMINDER,
        dedupeKey: expect.stringMatching(/^reconcile:13:/),
      }),
    );
    expect(result.skipped).toBe(1);
  });
});
