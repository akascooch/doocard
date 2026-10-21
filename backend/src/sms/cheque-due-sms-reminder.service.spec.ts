import { Logger } from '@nestjs/common';
import {
  ChequeDueSmsReminderService,
  CHEQUE_DUE_REMINDER_PHONES,
} from './cheque-due-sms-reminder.service';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';
import { SMS_EVENT_KEYS } from './sms-event-keys';

describe('ChequeDueSmsReminderService', () => {
  const prisma = {
    chequeLeaf: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    notification: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };
  const smsOutbound = {
    sendIfAllowed: jest.fn(),
  };
  const smsTemplates = {
    renderByKey: jest.fn().mockResolvedValue('mock-sms-body'),
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'CHEQUE_DUE_SMS_ENABLED') return 'true';
      return undefined;
    }),
  };

  let service: ChequeDueSmsReminderService;

  const bankAccount = {
    name: 'ملت شعبه ونک',
    accountNo: '123456789012',
    cardNo: null,
    iban: 'IR000000000000000000000001',
  };

  const fakePlanItem = {
    leafId: 7,
    leafNumber: 70,
    dueDate: '2026-07-27',
    jalaliDueDate: '1405/05/05',
    offsetDays: 2 as const,
    stage: 't_minus_2' as const,
    phone: '09000000001',
    relatedEntity: 'cheque:reminder:7:t_minus_2:1405/05/05',
    dedupeKey: 'cheque:reminder:7:t_minus_2:1405/05/05:0001',
    message: 'mock-sms-body',
  };

  function setChequeDueFlag(value: string | undefined) {
    config.get.mockImplementation((key: string) => {
      if (key === 'CHEQUE_DUE_SMS_ENABLED') return value;
      return undefined;
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setChequeDueFlag('true');
    service = new ChequeDueSmsReminderService(
      config as any,
      prisma as any,
      smsOutbound as any,
      smsTemplates as any,
    );
  });

  it('exposes the required reminder phones', () => {
    expect([...CHEQUE_DUE_REMINDER_PHONES]).toHaveLength(2);
    expect(CHEQUE_DUE_REMINDER_PHONES.every((p) => /^09\d{9}$/.test(p))).toBe(
      true,
    );
  });

  it('treats only exact "true" as enabled', () => {
    setChequeDueFlag('true');
    expect(service.isChequeDueSmsEnabled()).toBe(true);
    for (const value of [undefined, '', 'false', 'TRUE', '1', 'yes', 'on']) {
      setChequeDueFlag(value);
      expect(service.isChequeDueSmsEnabled()).toBe(false);
    }
  });

  it('formats bank name and last-4 account digits', () => {
    expect(
      ChequeDueSmsReminderService.formatBankDetails(bankAccount),
    ).toEqual({
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
    expect(ChequeDueSmsReminderService.formatBankDetails({ name: '   ' })).toEqual({
      bankName: '—',
      branch: '—',
      accountNumber: '—',
    });
    expect(ChequeDueSmsReminderService.formatChequeBookSerial(null)).toBe('—');
    expect(ChequeDueSmsReminderService.formatChequeBookSerial({})).toBe('—');
    expect(ChequeDueSmsReminderService.formatAmountRial(null)).toBe('—');
  });

  it('converts Gregorian due date to Jalali slash form', () => {
    expect(ChequeDueSmsReminderService.gregorianYmdToJalali('2026-03-21')).toBe(
      '1405/01/01',
    );
  });

  it('builds T-3 / T-2 / T-1 / T-0 plan with bank fields (no send)', async () => {
    const now = new Date('2026-07-25T12:00:00+03:30');
    const today = ChequeDueSmsReminderService.todayYmdTehran(now);

    prisma.chequeLeaf.findMany
      .mockResolvedValueOnce([
        {
          id: 8,
          leafNumber: 99,
          amount: 400n,
          payee: 'Y',
          dueDate: new Date(),
          category: 'NORMAL',
          chequebook: { serialNumber: 'CB-1', startNumber: 1, endNumber: 25, bankAccount },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 9,
          leafNumber: 100,
          amount: 500n,
          payee: 'Z',
          dueDate: new Date(),
          category: 'NORMAL',
          chequebook: { serialNumber: 'CB-1', startNumber: 1, endNumber: 25, bankAccount },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 10,
          leafNumber: 101,
          amount: 1000n,
          payee: 'A',
          dueDate: new Date(),
          category: 'NORMAL',
          chequebook: { serialNumber: 'CB-1', startNumber: 1, endNumber: 25, bankAccount },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 11,
          leafNumber: 102,
          amount: 2000n,
          payee: 'B',
          dueDate: new Date(),
          category: 'GUARANTEE',
          chequebook: { serialNumber: 'CB-1', startNumber: 1, endNumber: 25, bankAccount },
        },
      ]);

    const plan = await service.buildPlan({ now });
    expect(plan).toHaveLength(8);
    expect(plan.map((p) => p.offsetDays).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect([...new Set(plan.map((p) => p.stage))].sort()).toEqual([
      't_minus_1',
      't_minus_2',
      't_minus_3',
      't_zero',
    ]);
    expect(plan.filter((p) => p.offsetDays === 2)[0].dueDate).toBe(
      ChequeDueSmsReminderService.addDaysYmd(today, 2),
    );
    expect(plan.every((p) => p.dedupeKey.startsWith('cheque:reminder:'))).toBe(true);
    expect(
      plan.every((p) =>
        /^cheque:reminder:\d+:t_(minus_3|minus_2|minus_1|zero):\d{4}\/\d{2}\/\d{2}:\d{4}$/.test(
          p.dedupeKey,
        ),
      ),
    ).toBe(true);
    expect(new Set(plan.map((p) => p.phone))).toEqual(
      new Set(CHEQUE_DUE_REMINDER_PHONES),
    );
    const leaf9Keys = plan.filter((p) => p.leafId === 9).map((p) => p.dedupeKey);
    expect(leaf9Keys).toHaveLength(2);
    expect(new Set(leaf9Keys).size).toBe(2);
    expect(plan.every((p) => /^09\d{9}$/.test(p.phone))).toBe(true);
    expect(smsTemplates.renderByKey).toHaveBeenCalledWith(
      SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
      expect.objectContaining({
        stageLabel: expect.stringMatching(/امروز|فردا|۲ روز آینده/),
        bankName: 'ملت',
        branch: 'ونک',
        chequeBookSerial: 'CB-1',
        jalaliDueDate: expect.stringMatching(/^\d{4}\/\d{2}\/\d{2}$/),
        amount: expect.stringContaining('ریال'),
      }),
    );
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('plans only the next upcoming offset and does not replay a missed earlier day', async () => {
    const now = new Date('2026-07-25T12:00:00+03:30');
    const today = ChequeDueSmsReminderService.todayYmdTehran(now);
    const tomorrow = ChequeDueSmsReminderService.addDaysYmd(today, 1);
    const { start } = ChequeDueSmsReminderService.dayBoundsTehran(tomorrow);
    prisma.chequeLeaf.findMany.mockImplementation(async (args: { where: { dueDate: { gte: Date } } }) => {
      if (args.where.dueDate.gte.getTime() === start.getTime()) {
        return [{
          id: 21,
          leafNumber: 21,
          amount: 1000n,
          payee: 'Next',
          dueDate: start,
          category: 'NORMAL',
          chequebook: { serialNumber: 'CB-1', bankAccount },
        }];
      }
      return [];
    });

    const plan = await service.buildPlan({ now });
    expect(plan.map((item) => item.offsetDays)).toEqual([1, 1]);
    expect(plan.every((item) => item.stage === 't_minus_1')).toBe(true);
    expect(plan.some((item) => item.offsetDays === 3 || item.offsetDays === 2 || item.offsetDays === 0)).toBe(false);
  });

  it('dryRun does not call outbound send when flag is on', async () => {
    prisma.chequeLeaf.findMany.mockResolvedValue([
      {
        id: 1,
        leafNumber: 1,
        amount: 500n,
        payee: 'X',
        dueDate: new Date(),
        category: 'NORMAL',
        chequebook: { bankAccount },
      },
    ]);
    const result = await service.runReminders({
      now: new Date('2026-07-25T12:00:00+03:30'),
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.sent).toBe(0);
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('does not send or query when CHEQUE_DUE_SMS_ENABLED=false', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    setChequeDueFlag('false');
    const result = await service.runReminders({
      now: new Date('2026-07-25T12:00:00+03:30'),
    });
    expect(result).toEqual({
      planned: 0,
      sent: 0,
      skipped: 0,
      dryRun: true,
      items: [],
    });
    expect(prisma.chequeLeaf.findMany).not.toHaveBeenCalled();
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      'Cheque due SMS skipped (CHEQUE_DUE_SMS_ENABLED is not true)',
    );
    const joined = logSpy.mock.calls.map((c) => String(c[0])).join(' ');
    expect(joined).not.toMatch(/09\d{9}/);
    logSpy.mockRestore();
  });

  it.each([undefined, '', 'TRUE', '1', 'yes'])(
    'does not send when CHEQUE_DUE_SMS_ENABLED=%s',
    async (value) => {
      setChequeDueFlag(value);
      const result = await service.runReminders();
      expect(result.sent).toBe(0);
      expect(result.dryRun).toBe(true);
      expect(prisma.chequeLeaf.findMany).not.toHaveBeenCalled();
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    },
  );

  it('sends via outbound when CHEQUE_DUE_SMS_ENABLED=true', async () => {
    jest.spyOn(service, 'buildPlan').mockResolvedValue([fakePlanItem]);
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({ id: 1 });
    smsOutbound.sendIfAllowed.mockResolvedValue({
      success: true,
      skipped: false,
    });
    const result = await service.runReminders({
      now: new Date('2026-07-25T12:00:00+03:30'),
    });
    expect(result.dryRun).toBe(false);
    expect(result.sent).toBe(1);
    expect(result.skipped).toBe(0);
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          relatedEntity: fakePlanItem.relatedEntity,
          roleTarget: 'ADMIN',
        }),
      }),
    );
    expect(smsOutbound.sendIfAllowed).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: SMS_EVENT_KEYS.CHEQUE_DUE_REMINDER,
        phone: '09000000001',
        message: 'mock-sms-body',
        dedupeKey: fakePlanItem.dedupeKey,
        templateKey: SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
        skipAlwaysCc: true,
      }),
    );
  });

  it('uses ADMIN phones only when the role-recipient flag is on, without changing the dedupe key', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'CHEQUE_DUE_SMS_ENABLED') return 'false';
      if (key === 'CHEQUE_DUE_SMS_USE_ROLE_RECIPIENTS') return 'true';
      if (key === 'CHEQUE_DUE_SMS_INCLUDE_ACCOUNTANT') return 'true';
      return undefined;
    });
    prisma.user.findMany.mockResolvedValue([
      { phone: '09121111111' },
      { phone: 'not-a-phone' },
      { phone: '09121111111' },
      { phone: '09350000000' },
    ]);

    const phones = await service.resolveReminderPhones();
    expect(phones).toEqual(['09121111111', '09350000000']);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { role: { in: ['ADMIN', 'ACCOUNTANT'] } },
      }),
    );
    const dedupe = ChequeDueSmsReminderService.dedupeKey(
      7,
      't_minus_2',
      '1405/05/05',
      phones[0],
    );
    expect(dedupe).toBe('cheque:reminder:7:t_minus_2:1405/05/05:1111');
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('keeps the hardcoded recipients when the role-recipient flag is off', async () => {
    const phones = await service.resolveReminderPhones();
    expect(phones).toEqual([...CHEQUE_DUE_REMINDER_PHONES]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('cron exits safely and does not duplicate send when flag is off', async () => {
    setChequeDueFlag('false');
    await service.scheduledReminders();
    await service.scheduledReminders();
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    expect(prisma.chequeLeaf.findMany).not.toHaveBeenCalled();
    expect(prisma.chequeLeaf.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.notification.findFirst).not.toHaveBeenCalled();
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  describe('test allowlist + preview + test-send', () => {
    const leafRow = {
      id: 31,
      leafNumber: 310,
      amount: 7_000n,
      payee: 'T',
      dueDate: new Date('2026-07-27T08:00:00Z'),
      category: 'NORMAL',
      chequebook: { serialNumber: 'CB-9', bankAccount },
    };

    function setEnv(env: Record<string, string | undefined>) {
      config.get.mockImplementation((key: string) => env[key]);
    }

    it('restricts recipients to CHEQUE_DUE_SMS_TEST_PHONES and ignores role recipients', async () => {
      setEnv({
        CHEQUE_DUE_SMS_TEST_PHONES: '09121013686, 09370504588',
        CHEQUE_DUE_SMS_USE_ROLE_RECIPIENTS: 'true',
        CHEQUE_DUE_SMS_INCLUDE_ACCOUNTANT: 'true',
      });
      expect(service.isTestMode()).toBe(true);
      expect(await service.resolveReminderPhones()).toEqual(['09121013686', '09370504588']);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('accepts up to 3 allowlisted phones and dedupes equivalent formats', async () => {
      setEnv({ CHEQUE_DUE_SMS_TEST_PHONES: '09121013686;+989121013686 09370504588,09121111111' });
      expect(await service.resolveReminderPhones()).toEqual([
        '09121013686',
        '09370504588',
        '09121111111',
      ]);
    });

    it('fails closed (no recipients at all) when the allowlist has more than 3 phones', async () => {
      setEnv({
        CHEQUE_DUE_SMS_TEST_PHONES: '09121111111,09122222222,09123333333,09124444444',
        CHEQUE_DUE_SMS_ENABLED: 'true',
        CHEQUE_DUE_SMS_USE_ROLE_RECIPIENTS: 'true',
      });
      prisma.chequeLeaf.findMany.mockResolvedValue([leafRow]);
      expect(await service.resolveReminderPhones()).toEqual([]);
      const result = await service.runReminders({ now: new Date('2026-07-25T12:00:00+03:30') });
      expect(result.planned).toBe(0);
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('cron with the allowlist set but CHEQUE_DUE_SMS_ENABLED off neither queries nor sends', async () => {
      setEnv({ CHEQUE_DUE_SMS_TEST_PHONES: '09121013686,09370504588', CHEQUE_DUE_SMS_ENABLED: 'false' });
      await service.scheduledReminders();
      expect(prisma.chequeLeaf.findMany).not.toHaveBeenCalled();
      expect(prisma.chequeLeaf.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(prisma.notification.create).not.toHaveBeenCalled();
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    });

    it('allowlist mode sends the real cron plan only to allowlisted phones without CC', async () => {
      setEnv({ CHEQUE_DUE_SMS_TEST_PHONES: '09121013686', CHEQUE_DUE_SMS_ENABLED: 'true' });
      prisma.chequeLeaf.findMany.mockResolvedValueOnce([leafRow]).mockResolvedValue([]);
      prisma.notification.findFirst.mockResolvedValue(null);
      prisma.notification.create.mockResolvedValue({ id: 1 });
      smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: false });
      await service.runReminders({ now: new Date('2026-07-25T12:00:00+03:30') });
      const phones = smsOutbound.sendIfAllowed.mock.calls.map((c: [any]) => c[0].phone);
      expect(phones).toEqual(['09121013686']);
      expect(smsOutbound.sendIfAllowed.mock.calls[0][0].skipAlwaysCc).toBe(true);
      for (const real of CHEQUE_DUE_REMINDER_PHONES) {
        if (real !== '09121013686') expect(phones).not.toContain(real);
      }
    });

    it('builds offsets 3..0 (T-3 first) on Tehran day bounds', async () => {
      prisma.chequeLeaf.findMany.mockResolvedValue([]);
      await service.buildChequeReminderPlan(new Date('2026-07-25T23:50:00+03:30'));
      const windows = prisma.chequeLeaf.findMany.mock.calls.map(
        (c: [{ where: { dueDate: { gte: Date; lte: Date } } }]) => c[0].where.dueDate,
      );
      expect(windows.map((w: { gte: Date }) => w.gte.toISOString())).toEqual([
        '2026-07-27T20:30:00.000Z',
        '2026-07-26T20:30:00.000Z',
        '2026-07-25T20:30:00.000Z',
        '2026-07-24T20:30:00.000Z',
      ]);
      for (const w of windows) {
        expect(w.lte.getTime() - w.gte.getTime()).toBe(86_400_000 - 1);
      }
    });

    it('never falls back to default recipients when the allowlist is invalid', async () => {
      setEnv({ CHEQUE_DUE_SMS_TEST_PHONES: 'not-a-phone', CHEQUE_DUE_SMS_ENABLED: 'true' });
      prisma.chequeLeaf.findMany.mockResolvedValue([leafRow]);
      expect(await service.resolveReminderPhones()).toEqual([]);
      const plan = await service.buildChequeReminderPlan(new Date('2026-07-25T12:00:00+03:30'));
      expect(plan).toHaveLength(0);
    });

    it('limits the plan window to maxOffsetDays and uses Tehran day bounds', async () => {
      prisma.chequeLeaf.findMany.mockResolvedValue([]);
      const now = new Date('2026-07-25T00:10:00+03:30');
      await service.buildChequeReminderPlan(now, 1);
      const windows = prisma.chequeLeaf.findMany.mock.calls.map(
        (c: [{ where: { dueDate: { gte: Date; lte: Date } } }]) => c[0].where.dueDate,
      );
      expect(windows).toHaveLength(2);
      expect(windows[0].gte.toISOString()).toBe('2026-07-25T20:30:00.000Z');
      expect(windows[1].gte.toISOString()).toBe('2026-07-24T20:30:00.000Z');
      expect(windows[1].lte.toISOString()).toBe('2026-07-25T20:29:59.999Z');
    });

    it('preview works with sending disabled, masks phones, and never sends', async () => {
      setEnv({ CHEQUE_DUE_SMS_ENABLED: 'false' });
      prisma.chequeLeaf.findMany.mockResolvedValueOnce([leafRow]).mockResolvedValue([]);
      const preview = await service.previewPlan({ now: new Date('2026-07-25T12:00:00+03:30'), days: 3 });
      expect(preview.enabled).toBe(false);
      expect(preview.count).toBe(2);
      expect(preview.leafIds).toEqual([31]);
      expect(preview.recipients.every((p) => /^\*+\d{4}$/.test(p))).toBe(true);
      expect(JSON.stringify(preview)).not.toMatch(/09\d{9}/);
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    });

    it('test-send sends exactly one message per distinct phone even if the allowlist repeats it', async () => {
      setEnv({ CHEQUE_DUE_SMS_TEST_PHONES: '09121013686,+989121013686,9121013686' });
      prisma.chequeLeaf.findFirst.mockResolvedValue(leafRow);
      smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: false });
      await service.sendTestReminder({ now: new Date('2026-07-25T12:00:00+03:30') });
      expect(smsOutbound.sendIfAllowed).toHaveBeenCalledTimes(1);
      expect(smsOutbound.sendIfAllowed.mock.calls[0][0].dedupeKey.startsWith('cheque:reminder-test:')).toBe(true);
    });

    it('test-send refuses when the allowlist is missing or too long', async () => {
      setEnv({});
      await expect(service.sendTestReminder({})).rejects.toThrow('CHEQUE_DUE_SMS_TEST_PHONES');
      setEnv({ CHEQUE_DUE_SMS_TEST_PHONES: '09121111111,09122222222,09123333333,09124444444' });
      await expect(service.sendTestReminder({})).rejects.toThrow();
      expect(prisma.chequeLeaf.findFirst).not.toHaveBeenCalled();
      expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    });

    it('test-send sends once per allowlisted phone, no CC, separate dedupe namespace, no in-app notice', async () => {
      setEnv({ CHEQUE_DUE_SMS_TEST_PHONES: '09121013686,09370504588', CHEQUE_DUE_SMS_ENABLED: 'false' });
      prisma.chequeLeaf.findFirst.mockResolvedValue(leafRow);
      smsOutbound.sendIfAllowed.mockResolvedValue({ success: true, skipped: false });

      const result = await service.sendTestReminder({ now: new Date('2026-07-25T12:00:00+03:30') });

      expect(smsOutbound.sendIfAllowed).toHaveBeenCalledTimes(2);
      const calls = smsOutbound.sendIfAllowed.mock.calls.map((c: [any]) => c[0]);
      expect(calls.map((c: any) => c.phone)).toEqual(['09121013686', '09370504588']);
      for (const call of calls) {
        expect(call.skipAlwaysCc).toBe(true);
        expect(call.eventKey).toBe(SMS_EVENT_KEYS.CHEQUE_DUE_REMINDER);
        expect(call.dedupeKey).toMatch(/^cheque:reminder-test:31:2026-07-25:\d{4}$/);
        expect(call.message.startsWith('[پیام آزمایشی]')).toBe(true);
      }
      expect(result.results.every((r) => r.sent)).toBe(true);
      expect(JSON.stringify(result)).not.toMatch(/09\d{9}/);
      expect(prisma.notification.create).not.toHaveBeenCalled();
    });
  });
});
