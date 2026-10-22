import { BadRequestException } from '@nestjs/common';
import { PaymentMethod, Prisma, TipRecipientType, TransactionType } from '@prisma/client';

export const MANUAL_TIP_SOURCE_TYPE = 'MANUAL_TIP';
export const SETTLE_MANUAL_TIP_KEY_RE = /^settle-manual-tip:\d+$/;

export function settleManualTipIdempotencyKey(appointmentId: number): string {
  return `settle-manual-tip:${appointmentId}`;
}

export function isReservedSettleManualTipKey(key: string | null | undefined): boolean {
  return SETTLE_MANUAL_TIP_KEY_RE.test((key ?? '').trim());
}

/** @deprecated Always true in v1. MANUAL_TIP_ALLOW_SERVICE is ignored. */
export function manualTipAllowsService(_env: NodeJS.ProcessEnv = process.env): boolean {
  return true;
}

export function assertManualTipRecipient(
  role: string | null | undefined,
  _allowService = true,
): void {
  if (role === 'EMPLOYEE' || role === 'SERVICE') return;
  throw new BadRequestException('گیرنده انعام دستی باید آرایشگر یا پرسنل خدمات باشد');
}

/**
 * SERVICE checkout manual tip is also a payable allocation (salary preview).
 * Unique idempotencyKey settle-manual-tip:{appointmentId}. Duplicate → skip.
 */
export async function ensureSettleServiceManualTipPayable(
  tx: Prisma.TransactionClient,
  input: {
    appointmentId: number;
    amountRial: bigint;
    recipientEmployeeId: number;
    createdByUserId: number;
  },
): Promise<'created' | 'skipped'> {
  const idempotencyKey = settleManualTipIdempotencyKey(input.appointmentId);
  const existing = await tx.tipSource.findUnique({
    where: { idempotencyKey },
    select: { id: true },
  });
  if (existing) return 'skipped';
  try {
    await tx.tipSource.create({
      data: {
        tipType: TipRecipientType.INDIVIDUAL,
        amountRial: input.amountRial,
        effectiveBusinessAt: new Date(),
        createdByUserId: input.createdByUserId,
        note: `انعام دستی تسویه نوبت #${input.appointmentId}`,
        idempotencyKey,
        recipientEmployeeId: input.recipientEmployeeId,
        allocations: {
          create: [
            {
              employeeId: input.recipientEmployeeId,
              amountRial: input.amountRial,
            },
          ],
        },
      },
    });
    return 'created';
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return 'skipped';
    }
    throw err;
  }
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
