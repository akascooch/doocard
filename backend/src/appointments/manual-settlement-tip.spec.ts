import { BadRequestException } from '@nestjs/common';
import {
  assertManualTipRecipient,
  bookManualSettlementTip,
  manualTipAllowsService,
} from './manual-settlement-tip';

describe('manual settlement tip', () => {
  it('allows a hairdresser and rejects service staff unless the flag is on', () => {
    expect(() => assertManualTipRecipient('EMPLOYEE', false)).not.toThrow();
    expect(() => assertManualTipRecipient('SERVICE', false)).toThrow(BadRequestException);
    expect(() => assertManualTipRecipient('SERVICE', true)).not.toThrow();
    expect(manualTipAllowsService({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      manualTipAllowsService({ MANUAL_TIP_ALLOW_SERVICE: 'true' } as NodeJS.ProcessEnv),
    ).toBe(true);
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
});
