import {
  frogReminderWindow,
  FROG_REMINDER_15M_LEAD_MIN,
  tehranDueTime,
  tehranScheduledAt,
} from './frog-schedule.util';
import { FrogReminderScheduler } from './frog-reminder.scheduler';
import { SMS_EVENT_KEYS } from '../sms/sms-event-keys';

describe('frog-schedule.util', () => {
  it('builds a 10-minute window around 2 hours ahead', () => {
    const now = new Date('2026-09-14T10:00:00.000Z');
    const { from, to } = frogReminderWindow(now);
    expect(from.toISOString()).toBe('2026-09-14T11:55:00.000Z');
    expect(to.toISOString()).toBe('2026-09-14T12:05:00.000Z');
  });

  it('builds a 10-minute window around 15 minutes ahead', () => {
    const now = new Date('2026-09-14T10:00:00.000Z');
    const { from, to } = frogReminderWindow(now, FROG_REMINDER_15M_LEAD_MIN);
    expect(from.toISOString()).toBe('2026-09-14T10:10:00.000Z');
    expect(to.toISOString()).toBe('2026-09-14T10:20:00.000Z');
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
  const push = { sendToUser: jest.fn() };
  const scheduler = new FrogReminderScheduler(
    prisma as never,
    smsOutbound as never,
    push as never,
  );
  const now = new Date('2026-09-14T10:00:00.000Z');
  const dueAt = new Date('2026-09-14T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.adminDailyFrog.findMany
      .mockResolvedValueOnce([
        {
          id: 't1',
          userId: 4,
          title: 'مرور صندوق',
          scheduledAt: dueAt,
          isCompleted: false,
          reminder2hSent: false,
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.adminDailyFrog.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({ phone: '09121234567' });
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true });
    push.sendToUser.mockResolvedValue({ sent: 1, failed: 0 });
  });

  it('claims the row then sends one SMS with skipAlwaysCc', async () => {
    const result = await scheduler.dispatch(now);
    expect(result).toEqual({ claimed: 1, sent: 1, skipped: 0, considered: 1 });
    expect(prisma.adminDailyFrog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1', reminder2hSent: false, isCompleted: false },
        data: expect.objectContaining({ reminder2hSent: true, reminderSent: true }),
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
    expect(push.sendToUser).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ title: '🐸 [قورباغه مهم]' }),
    );
  });

  it('does not send when another worker already claimed the row', async () => {
    prisma.adminDailyFrog.updateMany.mockResolvedValue({ count: 0 });
    const result = await scheduler.dispatch(now);
    expect(result.claimed).toBe(0);
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('releases the 2h claim when SMS fails and push sends nothing', async () => {
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: false, skipped: false });
    push.sendToUser.mockResolvedValue({ sent: 0, failed: 0 });
    const result = await scheduler.dispatch(now);
    expect(result.sent).toBe(0);
    expect(prisma.adminDailyFrog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't1', reminder2hSent: true, isCompleted: false },
        data: expect.objectContaining({ reminder2hSent: false, reminderSent: false }),
      }),
    );
  });

  it('dispatches the 15m window independently of the 2h window', async () => {
    const due15 = new Date('2026-09-14T10:15:00.000Z');
    prisma.adminDailyFrog.findMany
      .mockReset()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 't15',
          userId: 4,
          title: 'مرور صندوق',
          scheduledAt: due15,
          isCompleted: false,
          reminder15mSent: false,
        },
      ]);
    const result = await scheduler.dispatch(now);
    expect(result).toEqual({ claimed: 1, sent: 1, skipped: 0, considered: 1 });
    expect(prisma.adminDailyFrog.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 't15', reminder15mSent: false, isCompleted: false },
        data: expect.objectContaining({ reminder15mSent: true }),
      }),
    );
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.FROG_REMINDER_15M,
        skipAlwaysCc: true,
        dedupeKey: 'frog-reminder-15m:t15',
      }),
    );
    expect(smsOutbound.sendIfAllowed.mock.calls[0][0].message).toContain('۱۵ دقیقه');
  });
});
