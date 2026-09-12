import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

export const PAYMENT_NOT_ALLOWED_FOR_QUOTE = 'PAYMENT_NOT_ALLOWED_FOR_QUOTE';
export const PAYMENT_NOT_ALLOWED_FOR_QUOTE_FA =
  'تا اعلام قیمت نهایی، ثبت پرداخت برای این سفارش مجاز نیست';

export function orderRequiresQuote(
  products: { isPriceVisible: boolean }[],
): boolean {
  return products.some((product) => product.isPriceVisible === false);
}

export function quoteUnitPriceRial(
  isPriceVisible: boolean,
  dbPriceRial: bigint,
): bigint {
  return isPriceVisible === false ? 0n : dbPriceRial;
}

export function quoteOrderTotalRial(requiresQuote: boolean, lineSumRial: bigint): bigint {
  return requiresQuote ? 0n : lineSumRial;
}

export function initialShopOrderStatus(requiresQuote: boolean): OrderStatus {
  return requiresQuote ? OrderStatus.AWAITING_QUOTE : OrderStatus.PENDING_VERIFICATION;
}

/** Paid confirmation is blocked until the quote is converted to a payable status. */
export function assertQuoteCannotBeMarkedPaid(from: OrderStatus, to: OrderStatus): void {
  if (from === OrderStatus.AWAITING_QUOTE && to === OrderStatus.PAID) {
    throw new BadRequestException({
      statusCode: 400,
      error: PAYMENT_NOT_ALLOWED_FOR_QUOTE,
      message: PAYMENT_NOT_ALLOWED_FOR_QUOTE_FA,
    });
  }
}

export function parseQuotedTotalRial(raw: unknown): bigint | undefined {
  if (raw == null || raw === '') return undefined;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new BadRequestException('مبلغ اعلام‌شده نامعتبر است');
  }
  return BigInt(n);
}
