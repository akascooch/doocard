import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import {
  PAYMENT_NOT_ALLOWED_FOR_QUOTE,
  assertQuoteCannotBeMarkedPaid,
  initialShopOrderStatus,
  orderRequiresQuote,
  parseQuotedTotalRial,
  quoteOrderTotalRial,
  quoteUnitPriceRial,
} from './order-quote.util';

describe('order-quote.util', () => {
  it('treats hidden-price products as quote-required', () => {
    expect(orderRequiresQuote([{ isPriceVisible: true }])).toBe(false);
    expect(
      orderRequiresQuote([{ isPriceVisible: true }, { isPriceVisible: false }]),
    ).toBe(true);
  });

  it('zeros hidden unit prices and quote-order totals', () => {
    expect(quoteUnitPriceRial(true, 50000n)).toBe(50000n);
    expect(quoteUnitPriceRial(false, 50000n)).toBe(0n);
    expect(quoteOrderTotalRial(true, 90000n)).toBe(0n);
    expect(quoteOrderTotalRial(false, 90000n)).toBe(90000n);
  });

  it('starts quote carts as AWAITING_QUOTE and priced carts as PENDING_VERIFICATION', () => {
    expect(initialShopOrderStatus(true)).toBe(OrderStatus.AWAITING_QUOTE);
    expect(initialShopOrderStatus(false)).toBe(OrderStatus.PENDING_VERIFICATION);
  });

  it('blocks marking a quote order as PAID', () => {
    expect(() =>
      assertQuoteCannotBeMarkedPaid(OrderStatus.AWAITING_QUOTE, OrderStatus.PAID),
    ).toThrow(BadRequestException);
    try {
      assertQuoteCannotBeMarkedPaid(OrderStatus.AWAITING_QUOTE, OrderStatus.PAID);
    } catch (err) {
      expect((err as BadRequestException).getResponse()).toEqual(
        expect.objectContaining({ error: PAYMENT_NOT_ALLOWED_FOR_QUOTE }),
      );
    }
    expect(() =>
      assertQuoteCannotBeMarkedPaid(OrderStatus.PENDING_VERIFICATION, OrderStatus.PAID),
    ).not.toThrow();
  });

  it('parses a non-negative integer quoted total', () => {
    expect(parseQuotedTotalRial(12000)).toBe(12000n);
    expect(parseQuotedTotalRial(undefined)).toBeUndefined();
    expect(() => parseQuotedTotalRial(-1)).toThrow(BadRequestException);
    expect(() => parseQuotedTotalRial(1.5)).toThrow(BadRequestException);
  });
});
