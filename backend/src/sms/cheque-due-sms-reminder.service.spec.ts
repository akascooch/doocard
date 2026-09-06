import {
  ChequeDueSmsReminderService,
  CHEQUE_DUE_REMINDER_PHONES,
} from './cheque-due-sms-reminder.service';
import { SMS_TEMPLATE_KEYS } from './sms-template.catalog';

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

  let service: ChequeDueSmsReminderService;

  const bankAccount = {
    name: 'ملت شعبه ونک',
    accountNo: '123456789012',
    cardNo: null,
    iban: 'IR000000000000000000000001',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ChequeDueSmsReminderService(
      prisma as any,
      smsOutbound as any,
      smsTemplates as any,
    );
  });

  it('exposes the required reminder phones', () => {
    expect([...CHEQUE_DUE_REMINDER_PHONES]).toEqual([
      '09370504588',
      '09121013686',
    ]);
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
    expect(new Set(plan.map((p) => p.phone))).toEqual(
      new Set(CHEQUE_DUE_REMINDER_PHONES),
    );
    expect(smsTemplates.renderByKey).toHaveBeenCalledWith(
      SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
      expect.objectContaining({
        bankName: 'ملت شعبه ونک',
        accountNumber: '…9012',
      }),
    );
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('dryRun does not call outbound send', async () => {
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
});
