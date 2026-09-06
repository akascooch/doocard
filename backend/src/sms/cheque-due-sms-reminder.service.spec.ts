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
    dueDate: '2026-07-28',
    offsetDays: 3 as const,
    phone: '09000000001',
    dedupeKey: 'cheque.due:7:T-3:2026-07-28:0001',
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
    ).toEqual({ bankName: 'ملت شعبه ونک', accountNumber: '…9012' });
  });

  it('builds T-3 / T-2 / T-1 / T-0 plan with bank fields (no send)', async () => {
    const now = new Date('2026-07-25T12:00:00+03:30');
    const today = ChequeDueSmsReminderService.todayYmdTehran(now);

    prisma.chequeLeaf.findMany
      .mockResolvedValueOnce([
        {
          id: 9,
          leafNumber: 100,
          amount: 500n,
          payee: 'Z',
          dueDate: new Date(),
          category: 'NORMAL',
          chequebook: { bankAccount },
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
          chequebook: { bankAccount },
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
          chequebook: { bankAccount },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 12,
          leafNumber: 103,
          amount: 3000n,
          payee: 'C',
          dueDate: new Date(),
          category: 'NORMAL',
          chequebook: { bankAccount },
        },
      ]);

    const plan = await service.buildPlan({ now });
    expect(plan).toHaveLength(8);
    expect(plan.map((p) => p.offsetDays).sort()).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(plan.filter((p) => p.offsetDays === 3)[0].dueDate).toBe(
      ChequeDueSmsReminderService.addDaysYmd(today, 3),
    );
    expect(plan.every((p) => /^09\d{9}$/.test(p.phone))).toBe(true);
    expect(smsTemplates.renderByKey).toHaveBeenCalledWith(
      SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
      expect.objectContaining({
        bankName: 'ملت شعبه ونک',
        accountNumber: '…9012',
      }),
    );
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
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

  it('cron exits safely and does not duplicate send when flag is off', async () => {
    setChequeDueFlag('false');
    await service.scheduledReminders();
    await service.scheduledReminders();
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
    expect(prisma.chequeLeaf.findMany).not.toHaveBeenCalled();
  });
});
