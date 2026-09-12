import { ConflictException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { StockWaitlistChannel, StockWaitlistStatus } from '@prisma/client';

export const PRODUCT_IN_STOCK = 'PRODUCT_IN_STOCK';
export const PRODUCT_IN_STOCK_FA =
  'این محصول موجود است و نیازی به عضویت در خبررسانی نیست';
export const WAITLIST_NOT_FOUND_FA = 'موردی یافت نشد';
export const PHONE_REQUIRED = 'PHONE_REQUIRED';
export const PHONE_REQUIRED_FA = 'شماره موبایل معتبر برای این حساب یافت نشد';

export type WaitlistActor = {
  id?: unknown;
  sub?: unknown;
  userId?: unknown;
} | null | undefined;

export function waitlistActorUserId(user: WaitlistActor): number {
  const raw = user?.id ?? user?.sub ?? user?.userId;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    throw new UnauthorizedException('برای این عملیات باید وارد شوید');
  }
  return n;
}

export function productInStockException() {
  return new ConflictException({
    statusCode: 409,
    error: PRODUCT_IN_STOCK,
    message: PRODUCT_IN_STOCK_FA,
  });
}

export function waitlistNotFoundException() {
  return new NotFoundException(WAITLIST_NOT_FOUND_FA);
}

export function serializeWaitlist(row: {
  id: string;
  productId: number;
  userId: number;
  channel: StockWaitlistChannel;
  status: StockWaitlistStatus;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt: Date | null;
  notifiedAt: Date | null;
}) {
  return {
    id: row.id,
    productId: row.productId,
    userId: row.userId,
    channel: row.channel,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    cancelledAt: row.cancelledAt,
    notifiedAt: row.notifiedAt,
  };
}
