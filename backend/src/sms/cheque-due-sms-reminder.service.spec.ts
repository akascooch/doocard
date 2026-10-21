import { Logger } from '@nestjs/common';
import {
  CHEQUE_DUE_CRON,
  CHEQUE_DUE_CRON_TZ,
  ChequeDueSmsReminderService,
} from './cheque-due-sms-reminder.service';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';
import { SMS_EVENT_KEYS } from './sms-event-keys';

describe('ChequeDueSmsReminderService', () => {
  const prisma = {
    chequeLeaf: { findMany: jest.fn() },
    notification: { findFirst: jest.fn(), create: jest.fn() },
    user: { findMany: jest.fn() },
    smsEvent: { findMany: jest.fn() },
  };
  const smsOutbound = { sendIfAllowed: jest.fn() };
  const smsTemplates = { renderByKey: jest.fn() };
  const config = { get: jest.fn() };
  let env: Record<string, string | undefined>;
  let service: ChequeDueSmsReminderService;

  const bankAccount = {
    name: 'ملت شعبه ونک',
    accountNo: '123456789012',
    cardNo: null,
    iban: 'IR000000000000000000000001',
  };
  const leaf = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    leafNumber: id * 10,
    amount: 1_000n,
    payee: 'P',
    dueDate: new Date(),
    category: 'NORMAL',
    chequebook: { serialNumber: 'CB-1', startNumber: 1, endNumber: 25, bankAccount },
    ...extra,
  });
  const ADMINS = [
    { id: 1, name: 'Admin One', phone: '09370504588' },
    { id: 2, name: 'Admin Two', phone: '09120000001' },
  ];
  const NOW = new Date('2026-07-25T12:00:00+03:30');

  beforeEach(() => {
    jest.clearAllMocks();
    env = { CHEQUE_DUE_SMS_ENABLED: 'true' };
    config.get.mockImplementation((key: string) => env[key]);
    prisma.user.findMany.mockResolvedValue(ADMINS);
    prisma.chequeLeaf.findMany.mockResolvedValue([]);
    prisma.smsEvent.findMany.mockResolvedValue([]);
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({ id: 1 });
    smsTemplates.renderByKey.mockResolvedValue('mock-sms-body');
    smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: false });
    service = new ChequeDueSmsReminderService(
      config as any,
      prisma as any,
      smsOutbound as any,
      smsTemplates as any,
    );
  });

  /** Returns leaves only for the Tehran day that is `offset` days after NOW's Tehran day. */
  function leavesOnOffset(byOffset: Record<number, any[]>, now = NOW) {
    const today = ChequeDueSmsReminderService.todayYmdTehran(now);
    prisma.chequeLeaf.findMany.mockImplementation(async (args: any) => {
      for (const [offset, rows] of Object.entries(byOffset)) {
        const ymd = ChequeDueSmsReminderService.addDaysYmd(today, Number(offset));
        if (args.where.dueDate.gte.getTime() === ChequeDueSmsReminderService.dayBoundsTehran(ymd).start.getTime()) {
          return rows;
        }
      }
      return [];
    });
  }

  describe('schedule and kill-switch', () => {
    it('runs daily at 08:00 Asia/Tehran', () => {
      expect(CHEQUE_DUE_CRON).toBe('0 8 * * *');
      expect(CHEQUE_DUE_CRON_TZ).toBe('Asia/Tehran');
      const meta = Reflect.getMetadata(
        'SCHEDULE_CRON_OPTIONS',
        ChequeDueSmsReminderService.prototype.scheduledReminders,
      );
      expect(meta).toEqual(expect.objectContaining({ cronTime: '0 8 * * *', timeZone: 'Asia/Tehran' }));
    });

    it('treats only exact "true" as enabled', () => {
      expect(service.isChequeDueSmsEnabled()).toBe(true);
      for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes', 'on']) {
        env.CHEQUE_DUE_SMS_ENABLED = value;
        expect(service.isChequeDueSmsEnabled()).toBe(false);
      }
    });

    it.each([undefined, '', 'false', 'TRUE', '1'])(
      'CHEQUE_DUE_SMS_ENABLED=%s: cron neither queries nor sends',
      async (value) => {
        const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
        env.CHEQUE_DUE_SMS_ENABLED = value;
        await service.scheduledReminders();
        await service.scheduledReminders();
        expect(prisma.user.findMany).not.toHaveBeenCalled();
        expect(prisma.chequeLeaf.findMany).not.toHaveBeenCalled();
        expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
        expect(prisma.notification.create).not.toHaveBeenCalled();
        logSpy.mockRestore();
      },
    );

    it('cron swallows errors so the scheduler keeps running', async () => {
      const errSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      prisma.user.findMany.mockRejectedValue(new Error('db down'));
      await expect(service.scheduledReminders()).resolves.toBeUndefined();
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('db down'));
      errSpy.mockRestore();
    });
  });

  describe('getActiveAdminRecipients', () => {
    it('queries ADMIN users that are not deactivated staff', async () => {
      await service.getActiveAdminRecipients();
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            role: 'ADMIN',
            OR: [{ employee: { is: null } }, { employee: { is: { isActive: true } } }],
          },
        }),
      );
    });

    it('keeps only valid 09xxxxxxxxx phones, one recipient per unique phone, and warns without numbers', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      prisma.user.findMany.mockResolvedValue([
        { id: 1, name: 'A', phone: '09370504588' },
        { id: 2, name: 'B', phone: '+989370504588' },
        { id: 3, name: 'C', phone: '0912345' },
        { id: 4, name: 'D', phone: '9121111111' },
        { id: 5, name: 'E', phone: '۰۹۱۲۰۰۰۰۰۰۱' },
        { id: 6, name: 'F', phone: '' },
      ]);
      const recipients = await service.getActiveAdminRecipients();
      expect(recipients).toEqual([
        { userId: 1, name: 'A', phone: '09370504588' },
        { userId: 5, name: 'E', phone: '09120000001' },
      ]);
      expect(recipients.every((r) => /^09[0-9]{9}$/.test(r.phone))).toBe(true);
      const warned = warnSpy.mock.calls.map((c) => String(c[0])).join(' ');
      expect(JSON.parse(warnSpy.mock.calls[0][0] as string)).toEqual({
        event: 'cheque_due_reminder.invalid_admin_phones',
        activeAdmins: 6,
        invalidPhones: 3,
      });
      expect(warned).not.toMatch(/09\d{9}/);
      warnSpy.mockRestore();
    });

    it('ignores the removed CHEQUE_DUE_SMS_TEST_PHONES and role-mode flags', async () => {
      env.CHEQUE_DUE_SMS_TEST_PHONES = '09121013686';
      env.CHEQUE_DUE_SMS_USE_ROLE_RECIPIENTS = 'false';
      env.CHEQUE_DUE_SMS_INCLUDE_ACCOUNTANT = 'true';
      const recipients = await service.getActiveAdminRecipients();
      expect(recipients.map((r) => r.phone)).toEqual(['09370504588', '09120000001']);
      expect(prisma.user.findMany.mock.calls[0][0].where.role).toBe('ADMIN');
    });
  });

  describe('Tehran date windows', () => {
    it('targets offsets 3,2,1,0 on Tehran day bounds late in the Tehran evening', async () => {
      await service.findDueLeavesByOffset(new Date('2026-07-25T23:50:00+03:30'));
      const windows = prisma.chequeLeaf.findMany.mock.calls.map((c: any) => c[0].where.dueDate);
      expect(windows.map((w: any) => w.gte.toISOString())).toEqual([
        '2026-07-27T20:30:00.000Z',
        '2026-07-26T20:30:00.000Z',
        '2026-07-25T20:30:00.000Z',
        '2026-07-24T20:30:00.000Z',
      ]);
      for (const w of windows) expect(w.lte.getTime() - w.gte.getTime()).toBe(86_400_000 - 1);
    });

    it('uses the Tehran calendar day, not the UTC day, just after Tehran midnight', async () => {
      const now = new Date('2026-10-21T20:45:00Z');
      expect(ChequeDueSmsReminderService.todayYmdTehran(now)).toBe('2026-10-22');
      const { today, windows } = await service.findDueLeavesByOffset(now);
      expect(today).toBe('2026-10-22');
      expect(windows.map((w) => [w.offsetDays, w.dueDate, w.jalaliDueDate])).toEqual([
        [3, '2026-10-25', '1405/08/03'],
        [2, '2026-10-24', '1405/08/02'],
        [1, '2026-10-23', '1405/08/01'],
        [0, '2026-10-22', '1405/07/30'],
      ]);
      expect(windows[3].start.toISOString()).toBe('2026-10-21T20:30:00.000Z');
      expect(windows[3].end.toISOString()).toBe('2026-10-22T20:29:59.999Z');
    });

    it('locks offset -> stage -> due date: a cheque due 2026-10-22 is T-1 on 10-21 and T-0 (t_zero) on 10-22', async () => {
      const dueAt = new Date('2026-10-22T08:00:00+03:30');
      const runAt = new Date('2026-10-22T04:30:00Z');
      const dayBefore = new Date('2026-10-21T13:00:00+03:30');

      const expectedTable = [
        [3, 't_minus_3', '2026-10-25'],
        [2, 't_minus_2', '2026-10-24'],
        [1, 't_minus_1', '2026-10-23'],
        [0, 't_zero', '2026-10-22'],
      ];
      const { today, windows } = await service.findDueLeavesByOffset(runAt);
      expect(today).toBe('2026-10-22');
      expect(windows.map((w) => [w.offsetDays, w.stage, w.dueDate])).toEqual(expectedTable);

      leavesOnOffset({ 0: [leaf(63, { dueDate: dueAt })] }, runAt);
      const plan = await service.buildPlan(await service.getActiveAdminRecipients(), runAt);
      expect(plan.map((p) => [p.leafId, p.offsetDays, p.stage, p.dueDate, p.jalaliDueDate])).toEqual([
        [63, 0, 't_zero', '2026-10-22', '1405/07/30'],
        [63, 0, 't_zero', '2026-10-22', '1405/07/30'],
      ]);
      expect(plan.every((p) => p.dedupeKey.startsWith('cheque:reminder:63:t_zero:1405/07/30:'))).toBe(true);
      expect(smsTemplates.renderByKey).toHaveBeenCalledWith(
        SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
        expect.objectContaining({ stageLabel: 'امروز', jalaliDueDate: '1405/07/30' }),
      );

      jest.clearAllMocks();
      prisma.user.findMany.mockResolvedValue(ADMINS);
      prisma.smsEvent.findMany.mockResolvedValue([]);
      leavesOnOffset({ 1: [leaf(63, { dueDate: dueAt })] }, dayBefore);
      const preview = await service.previewPlan({ now: dayBefore });
      expect(preview.offsets.find((o) => o.leafIds.includes(63))).toEqual(
        expect.objectContaining({ offsetDays: 1, stage: 't_minus_1', dueDate: '2026-10-22' }),
      );
    });

    it('the 08:00 Tehran run maps to the same Tehran day', () => {
      expect(ChequeDueSmsReminderService.todayYmdTehran(new Date('2026-10-22T04:30:00Z'))).toBe('2026-10-22');
    });

    it('adds calendar days across month and year ends without timezone drift', () => {
      expect(ChequeDueSmsReminderService.addDaysYmd('2026-12-30', 3)).toBe('2027-01-02');
      expect(ChequeDueSmsReminderService.addDaysYmd('2028-02-27', 2)).toBe('2028-02-29');
      expect(ChequeDueSmsReminderService.addDaysYmd('2026-03-20', 1)).toBe('2026-03-21');
      expect(ChequeDueSmsReminderService.addDaysYmd('2026-07-25', 0)).toBe('2026-07-25');
    });

    it('converts Gregorian due date to Jalali slash form', () => {
      expect(ChequeDueSmsReminderService.gregorianYmdToJalali('2026-03-21')).toBe('1405/01/01');
    });
  });

  describe('dedupe key', () => {
    it('is stable per (cheque, offset, due date, phone) and never contains the full phone', () => {
      const a = ChequeDueSmsReminderService.dedupeKey(7, 't_minus_2', '1405/05/05', '09121234567');
      expect(ChequeDueSmsReminderService.dedupeKey(7, 't_minus_2', '1405/05/05', '09121234567')).toBe(a);
      expect(a).toMatch(/^cheque:reminder:7:t_minus_2:1405\/05\/05:4567\.[0-9a-f]{12}$/);
      expect(a).not.toContain('09121234567');
    });

    it('does not collide for two phones sharing the last 4 digits', () => {
      const a = ChequeDueSmsReminderService.dedupeKey(7, 't_zero', '1405/05/05', '09121234567');
      const b = ChequeDueSmsReminderService.dedupeKey(7, 't_zero', '1405/05/05', '09351234567');
      expect(a).not.toBe(b);
    });

    it('differs per offset and per due-date cycle', () => {
      const keys = new Set([
        ChequeDueSmsReminderService.dedupeKey(7, 't_minus_1', '1405/05/05', '09121234567'),
        ChequeDueSmsReminderService.dedupeKey(7, 't_zero', '1405/05/05', '09121234567'),
        ChequeDueSmsReminderService.dedupeKey(7, 't_zero', '1405/05/06', '09121234567'),
      ]);
      expect(keys.size).toBe(3);
    });
  });

  describe('plan', () => {
    it('builds one item per cheque per admin across T-3..T-0 and never sends', async () => {
      leavesOnOffset({ 3: [leaf(8)], 2: [leaf(9)], 1: [leaf(10)], 0: [leaf(11, { category: 'GUARANTEE' })] });
      const recipients = await service.getActiveAdminRecipients();
      const plan = await service.buildPlan(recipients, NOW);
      expect(plan).toHaveLength(8);
      expect(plan.map((p) => p.offsetDays).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
      expect(new Set(plan.map((p) => p.phone))).toEqual(new Set(['09370504588', '09120000001']));
      expect(new Set(plan.map((p) => p.dedupeKey)).size).toBe(8);
      expect(plan.find((p) => p.leafId === 9)?.stage).toBe('t_minus_2');
      expect(smsTemplates.renderByKey).toHaveBeenCalledTimes(4);
      expect(smsTemplates.renderByKey).toHaveBeenCalledWith(
        SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
        expect.objectContaining({
          bankName: 'ملت',
          branch: 'ونک',
          chequeBookSerial: 'CB-1',
          amount: expect.stringContaining('ریال'),
        }),
      );
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    });

    it('only issued, non-deleted leaves in live chequebooks are matched', async () => {
      await service.findDueLeavesByOffset(NOW);
      for (const [args] of prisma.chequeLeaf.findMany.mock.calls) {
        expect(args.where).toEqual(
          expect.objectContaining({ deletedAt: null, status: 'ISSUED', chequebook: { deletedAt: null } }),
        );
      }
    });
  });

  describe('runReminders', () => {
    it('aborts with a structured warning when no active admin has a valid phone', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      prisma.user.findMany.mockResolvedValue([{ id: 1, name: 'A', phone: 'bad' }]);
      const result = await service.runReminders({ now: NOW });
      expect(result).toEqual({ planned: 0, sent: 0, skipped: 0, alreadySent: 0, dryRun: true, items: [] });
      expect(prisma.chequeLeaf.findMany).not.toHaveBeenCalled();
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
      expect(warnSpy.mock.calls.map((c) => String(c[0]))).toContain(
        JSON.stringify({ event: 'cheque_due_reminder.aborted', reason: 'no_active_admin_with_valid_phone' }),
      );
      warnSpy.mockRestore();
    });

    it('sends once per admin per cheque, without CC, and records one in-app notice per cheque stage', async () => {
      leavesOnOffset({ 1: [leaf(21)] });
      const result = await service.runReminders({ now: NOW });
      expect(result.sent).toBe(2);
      expect(result.planned).toBe(2);
      const calls = smsOutbound.sendIfAllowed.mock.calls.map((c: any) => c[0]);
      expect(calls.map((c: any) => c.phone)).toEqual(['09370504588', '09120000001']);
      for (const call of calls) {
        expect(call).toEqual(
          expect.objectContaining({
            eventKey: SMS_EVENT_KEYS.CHEQUE_DUE_REMINDER,
            templateKey: SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
            skipAlwaysCc: true,
            message: 'mock-sms-body',
          }),
        );
        expect(call.dedupeKey).toMatch(/^cheque:reminder:21:t_minus_1:\d{4}\/\d{2}\/\d{2}:\d{4}\.[0-9a-f]{12}$/);
      }
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(result)).not.toMatch(/09\d{9}/);
    });

    it('skips keys already SENT or PENDING in sms_events, and retries FAILED ones', async () => {
      const debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
      leavesOnOffset({ 0: [leaf(31), leaf(32)] });
      const recipients = await service.getActiveAdminRecipients();
      const plan = await service.buildPlan(recipients, NOW);
      jest.clearAllMocks();
      prisma.user.findMany.mockResolvedValue(ADMINS);
      smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: false });
      prisma.smsEvent.findMany.mockResolvedValue([
        { dedupeKey: plan[0].dedupeKey, status: 'SENT' },
        { dedupeKey: plan[1].dedupeKey, status: 'PENDING' },
        { dedupeKey: plan[2].dedupeKey, status: 'FAILED' },
      ]);
      const result = await service.runReminders({ now: NOW });
      expect(prisma.smsEvent.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.smsEvent.findMany.mock.calls[0][0].where.dedupeKey.in).toHaveLength(4);
      const sentKeys = smsOutbound.sendIfAllowed.mock.calls.map((c: any) => c[0].dedupeKey);
      expect(sentKeys).toEqual([plan[2].dedupeKey, plan[3].dedupeKey]);
      expect(result.alreadySent).toBe(2);
      expect(result.sent).toBe(2);
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining(plan[0].dedupeKey));
      debugSpy.mockRestore();
    });

    it('a second run on the same day sends nothing', async () => {
      leavesOnOffset({ 0: [leaf(41)] });
      const sent: string[] = [];
      smsOutbound.sendIfAllowed.mockImplementation(async (p: any) => {
        sent.push(p.dedupeKey);
        return { success: true, skipped: false };
      });
      prisma.smsEvent.findMany.mockImplementation(async (args: any) =>
        args.where.dedupeKey.in.filter((k: string) => sent.includes(k)).map((k: string) => ({ dedupeKey: k, status: 'SENT' })),
      );
      const first = await service.runReminders({ now: NOW });
      const second = await service.runReminders({ now: NOW });
      expect(first.sent).toBe(2);
      expect(second.sent).toBe(0);
      expect(second.alreadySent).toBe(2);
      expect(smsOutbound.sendIfAllowed).toHaveBeenCalledTimes(2);
    });

    it('dryRun does not send', async () => {
      leavesOnOffset({ 0: [leaf(1)] });
      const result = await service.runReminders({ now: NOW, dryRun: true });
      expect(result.dryRun).toBe(true);
      expect(result.skipped).toBe(2);
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    });

    it('does not replay a missed earlier offset', async () => {
      leavesOnOffset({ 1: [leaf(21)] });
      const plan = await service.buildPlan(await service.getActiveAdminRecipients(), NOW);
      expect([...new Set(plan.map((p) => p.offsetDays))]).toEqual([1]);
    });
  });

  describe('previewPlan', () => {
    it('lists active admins and T-3..T-0 matches with sent/pending status, masked, without sending', async () => {
      env.CHEQUE_DUE_SMS_ENABLED = 'false';
      leavesOnOffset({ 2: [leaf(51)], 0: [leaf(52)] });
      const plan = await service.buildPlan(await service.getActiveAdminRecipients(), NOW);
      prisma.smsEvent.findMany.mockResolvedValue([{ dedupeKey: plan[0].dedupeKey, status: 'SENT' }]);

      const preview = await service.previewPlan({ now: NOW });

      expect(preview.enabled).toBe(false);
      expect(preview.schedule).toEqual({ cron: '0 8 * * *', timeZone: 'Asia/Tehran' });
      expect(preview.today).toBe('2026-07-25');
      expect(preview.recipients).toEqual([
        { userId: 1, name: 'Admin One', phone: '*******4588' },
        { userId: 2, name: 'Admin Two', phone: '*******0001' },
      ]);
      expect(preview.offsets.map((o) => [o.offsetDays, o.leafIds])).toEqual([
        [3, []],
        [2, [51]],
        [1, []],
        [0, [52]],
      ]);
      expect(preview.count).toBe(4);
      expect(preview.sentCount).toBe(1);
      expect(preview.pendingCount).toBe(3);
      expect(preview.items[0]).toEqual(expect.objectContaining({ dispatch: 'sent', lastStatus: 'SENT' }));
      expect(JSON.stringify(preview)).not.toMatch(/09\d{9}/);
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });

    it('queries cheque windows once per offset', async () => {
      await service.previewPlan({ now: NOW });
      expect(prisma.chequeLeaf.findMany).toHaveBeenCalledTimes(4);
    });
  });

  describe('formatting', () => {
    it('formats bank name and last-4 account digits', () => {
      expect(ChequeDueSmsReminderService.formatBankDetails(bankAccount)).toEqual({
        bankName: 'ملت',
        branch: 'ونک',
        accountNumber: '…9012',
      });
    });

    it('falls back to em-dash when bank / branch / serial / amount are missing', () => {
      expect(ChequeDueSmsReminderService.formatBankDetails(null)).toEqual({
        bankName: '—',
        branch: '—',
        accountNumber: '—',
      });
      expect(ChequeDueSmsReminderService.formatChequeBookSerial(null)).toBe('—');
      expect(ChequeDueSmsReminderService.formatAmountRial(null)).toBe('—');
    });
  });
});
