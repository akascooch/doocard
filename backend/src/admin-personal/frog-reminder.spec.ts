import { frogReminderWindow, tehranDueTime, tehranScheduledAt } from './frog-schedule.util';
import { FrogReminderScheduler } from './frog-reminder.scheduler';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';

describe('frog-schedule.util', () => {
  it('builds a 10-minute window around 2 hours ahead', () => {
    const now = new Date('2026-09-14T10:00:00.000Z');
    const { from, to } = frogReminderWindow(now);
    expect(from.toISOString()).toBe('2026-09-14T11:55:00.000Z');
    expect(to.toISOString()).toBe('2026-09-14T12:05:00.000Z');
  });

  it('interprets Tehran civil date+time as +03:30', () => {
    const at = tehranScheduledAt('2026-09-14', '14:30');
    expect(at.toISOString()).toBe('2026-09-14T11:00:00.000Z');
    expect(tehranDueTime(at)).toBe('14:30');
  });
});

describe('FrogReminderScheduler', () => {
  const prisma = {
    adminDailyFrog: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
  };
  const smsOutbound = { sendIfAllowed: jest.fn() };
  const scheduler = new FrogReminderScheduler(prisma as never, smsOutbound as never);
  const now = new Date('2026-09-14T10:00:00.000Z');
  const dueAt = new Date('2026-09-14T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminDailyFrog.findMany.mockResolvedValue([
      {
        id: 't1',
        userId: 4,
        title: 'مرور صندوق',
        scheduledAt: dueAt,
        isCompleted: false,
        reminderSent: false,
      },
    ]);
    prisma.adminDailyFrog.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ phone: '09121234567' });
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true });
  });

  it('claims the row then sends one SMS with skipAlwaysCc', async () => {
    const result = await scheduler.dispatch(now);
    expect(result).toEqual({ claimed: 1, sent: 1, skipped: 0, considered: 1 });
    expect(prisma.adminDailyFrog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1', reminderSent: false, isCompleted: false },
        data: expect.objectContaining({ reminderSent: true }),
      }),
    );
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.FROG_REMINDER,
        skipAlwaysCc: true,
        dedupeKey: 'frog-reminder:t1',
        phone: '09121234567',
      }),
    );
    expect(smsOutbound.sendIfAllowed.mock.calls[0][0].message).toContain('مرور صندوق');
    expect(smsOutbound.sendIfAllowed.mock.calls[0][0].message).toContain('15:30');
  });

  it('does not send when another worker already claimed the row', async () => {
    prisma.adminDailyFrog.updateMany.mockResolvedValue({ count: 0 });
    const result = await scheduler.dispatch(now);
    expect(result.claimed).toBe(0);
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });
});
