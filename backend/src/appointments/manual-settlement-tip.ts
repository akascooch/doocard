import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, Prisma, TransactionType } from '@prisma/client';

export const MANUAL_TIP_SOURCE_TYPE = 'MANUAL_TIP';

export function manualTipAllowsService(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.MANUAL_TIP_ALLOW_SERVICE === 'true';
}

export function assertManualTipRecipient(
  role: string | null | undefined,
  allowService = manualTipAllowsService(),
): void {
  if (role === 'EMPLOYEE') return;
  if (allowService && role === 'SERVICE') return;
  throw new BadRequestException('گیرنده انعام دستی باید آرایشگر باشد');
}

type ManualTipClient = Prisma.TransactionClient;

/**
 * One INCOME row and one bank increment. A second call for the same appointment skips both.
 * Not part of Appointment.tipAmount or commission share.
 */
export async function bookManualSettlementTip(
  tx: ManualTipClient,
  input: {
    appointmentId: number;
    amountRial: bigint;
    accountId: number;
    recipientEmployeeId: number;
    createdBy?: number | null;
    externalRef?: string | null;
    paymentMethod?: PaymentMethod | null;
  },
): Promise<'created' | 'skipped'> {
  if (input.amountRial <= 0n) return 'skipped';
  const existing = await tx.transaction.findFirst({
    where: {
      sourceType: MANUAL_TIP_SOURCE_TYPE,
      sourceId: input.appointmentId,
      type: TransactionType.INCOME,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) return 'skipped';

  await tx.transaction.create({
    data: {
      type: TransactionType.INCOME,
      amount: input.amountRial,
      description: `انعام دستی نوبت #${input.appointmentId}`,
      sourceType: MANUAL_TIP_SOURCE_TYPE,
      sourceId: input.appointmentId,
      accountId: input.accountId,
      employeeId: input.recipientEmployeeId,
      paymentMethod: input.paymentMethod ?? undefined,
      occurredAt: new Date(),
      createdBy: input.createdBy ?? undefined,
      meta: {
        appointmentId: input.appointmentId,
        isManualTip: true,
        externalRef: input.externalRef ?? null,
        recipientEmployeeId: input.recipientEmployeeId,
      },
    },
  });
  await tx.bankAccount.update({
    where: { id: input.accountId },
    data: { balance: { increment: input.amountRial } },
  });
  return 'created';
}
