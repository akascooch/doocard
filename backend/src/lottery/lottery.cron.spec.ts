import { LotteryService } from './lottery.service';
import { LotteryCronService } from './lottery-cron.service';
import {
  LotteryContributionStatus,
  LotteryCycleStatus,
  LotteryGroupStatus,
  LotteryPayoutStatus,
} from '@prisma/client';

describe('lottery cron idempotency and payout sizing', () => {
  it('second live run in the same period creates 0 extra rows', async () => {
    const contrib = new Map<string, { id: number }>();
    const payouts = new Map<string, { id: number; status: string; transactionId: number | null }>();
    const members = [
      { id: 1, groupId: 1, status: 'ACTIVE', prepaidRial: 10_000_000n },
      { id: 2, groupId: 1, status: 'ACTIVE', prepaidRial: 0n },
    ];
    const group = {
      id: 1,
      status: LotteryGroupStatus.ACTIVE,
      monthlyAmountRial: 10_000_000n,
      circleAccountId: 3,
    };
    const cycle = {
      id: 9,
      groupId: 1,
      cycleIndex: 1,
      status: LotteryCycleStatus.ACTIVE,
      memberCount: 2,
      slots: [{ id: 4, periodKey: '2026-10', memberId: 1, slotIndex: 1 }],
    };
    let bank = 50_000_000n;
    const txCreates: string[] = [];
    const tx = {
      $queryRaw: jest.fn(),
      lotteryGroup: { findUnique: jest.fn(async () => group) },
      lotteryCycle: { findFirst: jest.fn(async () => cycle) },
      lotteryMember: {
        findMany: jest.fn(async () => members),
        update: jest.fn(async ({ where, data }: any) => {
          const m = members.find((x) => x.id === where.id)!;
          if (data.prepaidRial?.decrement) m.prepaidRial -= data.prepaidRial.decrement;
          if (data.prepaidRial === 0n) m.prepaidRial = 0n;
          return m;
        }),
      },
      lotteryContributionEvent: {
        findUnique: jest.fn(async ({ where }: any) => contrib.get(where.idempotencyKey) ?? null),
        findMany: jest.fn(async () =>
          [...contrib.values()].map(() => ({
            amountRial: 10_000_000n,
            status: LotteryContributionStatus.POSTED,
          })),
        ),
        create: jest.fn(async ({ data }: any) => {
          contrib.set(data.idempotencyKey, { id: contrib.size + 1, ...data });
          return { id: contrib.size, ...data };
        }),
      },
      lotteryArrear: { upsert: jest.fn() },
      lotteryPayoutEvent: {
        findUnique: jest.fn(async ({ where }: any) => payouts.get(where.idempotencyKey) ?? null),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: payouts.size + 1, ...data };
          payouts.set(data.idempotencyKey, row);
          return row;
        }),
      },
      bankAccount: {
        findUnique: jest.fn(async () => ({ id: 3, balance: bank })),
        update: jest.fn(async ({ data }: any) => {
          if (data.balance?.decrement) bank -= data.balance.decrement;
          return { id: 3, balance: bank };
        }),
      },
      transaction: {
        create: jest.fn(async ({ data }: any) => {
          txCreates.push(data.sourceType);
          return { id: txCreates.length };
        }),
      },
    };
    const prisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };
    const service = new LotteryService(prisma as never);

    await service.runGroupPeriod(1, { mode: 'live', periodKey: '2026-10' });
    const afterFirst = { contrib: contrib.size, payouts: payouts.size, tx: txCreates.length };
    await service.runGroupPeriod(1, { mode: 'live', periodKey: '2026-10' });
    expect(contrib.size).toBe(afterFirst.contrib);
    expect(payouts.size).toBe(afterFirst.payouts);
    expect(txCreates.length).toBe(afterFirst.tx);
  });

  it('payout equals collectedRial when one member is in arrears and records shortfall', async () => {
    const members = [
      { id: 1, groupId: 1, status: 'ACTIVE', prepaidRial: 10_000_000n },
      { id: 2, groupId: 1, status: 'ACTIVE', prepaidRial: 0n },
    ];
    const contrib = new Map<string, any>();
    let payout: any = null;
    const tx = {
      $queryRaw: jest.fn(),
      lotteryGroup: {
        findUnique: jest.fn(async () => ({
          id: 1,
          status: LotteryGroupStatus.ACTIVE,
          monthlyAmountRial: 10_000_000n,
          circleAccountId: 3,
        })),
      },
      lotteryCycle: {
        findFirst: jest.fn(async () => ({
          id: 9,
          cycleIndex: 1,
          status: LotteryCycleStatus.ACTIVE,
          memberCount: 2,
          slots: [{ id: 4, periodKey: '2026-10', memberId: 1 }],
        })),
      },
      lotteryMember: {
        findMany: jest.fn(async () => members),
        update: jest.fn(async ({ where, data }: any) => {
          const m = members.find((x) => x.id === where.id)!;
          if (data.prepaidRial?.decrement) m.prepaidRial -= data.prepaidRial.decrement;
          if (data.prepaidRial === 0n) m.prepaidRial = 0n;
          return m;
        }),
      },
      lotteryContributionEvent: {
        findUnique: jest.fn(async ({ where }: any) => contrib.get(where.idempotencyKey) ?? null),
        findMany: jest.fn(async () =>
          [...contrib.values()].filter((c) => c.status === LotteryContributionStatus.POSTED),
        ),
        create: jest.fn(async ({ data }: any) => {
          contrib.set(data.idempotencyKey, data);
          return { id: contrib.size, ...data };
        }),
      },
      lotteryArrear: { upsert: jest.fn() },
      lotteryPayoutEvent: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }: any) => {
          payout = data;
          return data;
        }),
      },
      bankAccount: {
        findUnique: jest.fn(async () => ({ id: 3, balance: 100_000_000n })),
        update: jest.fn(),
      },
      transaction: { create: jest.fn(async () => ({ id: 77 })) },
    };
    const service = new LotteryService({ $transaction: async (fn: any) => fn(tx) } as never);
    const out = await service.runGroupPeriod(1, { mode: 'live', periodKey: '2026-10' });
    expect(payout.amountRial).toBe(10_000_000n);
    expect(payout.collectedRial).toBe(10_000_000n);
    expect(payout.payoutShortfallRial).toBe(10_000_000n);
    expect(payout.status).toBe(LotteryPayoutStatus.POSTED);
    expect(out.payoutStatus).toBe(LotteryPayoutStatus.POSTED);
  });

  it('cron expression is 08:00 Asia/Tehran', () => {
    const { LOTTERY_CRON, LOTTERY_CRON_TZ } = require('./lottery-cron.service');
    expect(LOTTERY_CRON).toBe('0 8 * * *');
    expect(LOTTERY_CRON_TZ).toBe('Asia/Tehran');
  });
});
