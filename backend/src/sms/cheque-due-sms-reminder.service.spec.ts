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

  it('builds T-2 / T-1 / T-0 plan with dedupe keys (no send)', async () => {
    const now = new Date('2026-07-25T12:00:00+03:30');
    const today = ChequeDueSmsReminderService.todayYmdTehran(now);

    prisma.chequeLeaf.findMany
      .mockResolvedValueOnce([
        {
          id: 10,
          leafNumber: 101,
          amount: 1000n,
          payee: 'A',
          dueDate: new Date(),
          category: 'NORMAL',
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
        },
      ]);

    const plan = await service.buildPlan({ now });
    // 3 leaves × 2 phones
    expect(plan).toHaveLength(6);
    expect(plan.map((p) => p.offsetDays).sort()).toEqual([0, 0, 1, 1, 2, 2]);
    expect(plan.filter((p) => p.offsetDays === 2)[0].dueDate).toBe(
      ChequeDueSmsReminderService.addDaysYmd(today, 2),
    );
    expect(new Set(plan.map((p) => p.phone))).toEqual(
      new Set(CHEQUE_DUE_REMINDER_PHONES),
    );
    expect(smsTemplates.renderByKey).toHaveBeenCalledWith(
      SMS_TEMPLATE_KEYS.CHEQUE_DUE_REMINDER,
      expect.any(Object),
    );
    expect(smsOutbound.sendIfAllowed).not.toHaveBeenCalled();
  });

  it('dryRun does not call outbound send', async () => {
    prisma.chequeLeaf.findMany.mockResolvedValue([
      { id: 1, leafNumber: 1, amount: 500n, payee: 'X', dueDate: new Date(), category: 'NORMAL' },
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
