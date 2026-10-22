import { BadRequestException } from '@nestjs/common';
import {
  assertManualTipRecipient,
  bookManualSettlementTip,
  ensureSettleServiceManualTipPayable,
  isReservedSettleManualTipKey,
  manualTipAllowsService,
  settleManualTipIdempotencyKey,
} from './manual-settlement-tip';

describe('manual settlement tip', () => {
  it('accepts hairdresser or SERVICE and ignores the deprecated env flag', () => {
    expect(() => assertManualTipRecipient('EMPLOYEE')).not.toThrow();
    expect(() => assertManualTipRecipient('SERVICE')).not.toThrow();
    expect(() => assertManualTipRecipient('ADMIN')).toThrow(BadRequestException);
    expect(manualTipAllowsService({} as NodeJS.ProcessEnv)).toBe(true);
    expect(isReservedSettleManualTipKey(settleManualTipIdempotencyKey(41))).toBe(true);
  });

  it('increments the bank once and skips a duplicate for the same appointment', async () => {
    const created: unknown[] = [];
    const increments: bigint[] = [];
    let existing: { id: number } | null = null;
    const tx = {
      transaction: {
        findFirst: jest.fn(async () => existing),
        create: jest.fn(async ({ data }: { data: { amount: bigint; sourceType: string } }) => {
          created.push(data);
          existing = { id: 1 };
          return data;
        }),
      },
      bankAccount: {
        update: jest.fn(async ({ data }: { data: { balance: { increment: bigint } } }) => {
          increments.push(data.balance.increment);
        }),
      },
    };

    const input = {
      appointmentId: 41,
      amountRial: 50000n,
      accountId: 12,
      recipientEmployeeId: 3,
      createdBy: 99,
      externalRef: 'settle_41',
    };

    await expect(bookManualSettlementTip(tx as never, input)).resolves.toBe('created');
    await expect(bookManualSettlementTip(tx as never, input)).resolves.toBe('skipped');

    expect(created).toHaveLength(1);
    expect(created[0]).toEqual(
      expect.objectContaining({ sourceType: 'MANUAL_TIP', amount: 50000n, employeeId: 3 }),
    );
    expect(increments).toEqual([50000n]);
    expect(tx.transaction.create.mock.calls[0][0].data.sourceType).not.toBe('TIP');
  });

  it('creates TipSource + allocation once for a SERVICE settle key', async () => {
    let existing: { id: number } | null = null;
    const tx = {
      tipSource: {
        findUnique: jest.fn(async () => existing),
        create: jest.fn(async ({ data }: { data: { idempotencyKey: string } }) => {
          existing = { id: 9 };
          return data;
        }),
      },
    };

    const input = {
      appointmentId: 41,
      amountRial: 50000n,
      recipientEmployeeId: 8,
      createdByUserId: 99,
    };

    await expect(ensureSettleServiceManualTipPayable(tx as never, input)).resolves.toBe('created');
    await expect(ensureSettleServiceManualTipPayable(tx as never, input)).resolves.toBe('skipped');
    expect(tx.tipSource.create).toHaveBeenCalledTimes(1);
    expect(tx.tipSource.create.mock.calls[0][0].data.idempotencyKey).toBe('settle-manual-tip:41');
    const created = tx.tipSource.create.mock.calls[0][0].data as {
      idempotencyKey: string
      allocations: { create: Array<{ employeeId: number; amountRial: bigint }> }
    }
    expect(created.idempotencyKey).toBe('settle-manual-tip:41')
    expect(created.allocations.create).toEqual([{ employeeId: 8, amountRial: 50000n }])
  });
});
