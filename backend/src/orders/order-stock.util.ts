import { BadRequestException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';

export const INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK';
export const INVALID_ORDER_QUANTITY = 'INVALID_ORDER_QUANTITY';

export function assertPositiveIntQuantity(quantity: unknown): number {
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    throw new BadRequestException({
      statusCode: 400,
      error: INVALID_ORDER_QUANTITY,
      message: 'تعداد سفارش باید عدد صحیح بزرگ‌تر از صفر باشد',
    });
  }
  return quantity;
}

export function insufficientStockException(productName: string, available: number) {
  const safeAvailable = Math.max(0, available);
  return new BadRequestException({
    statusCode: 400,
    error: INSUFFICIENT_STOCK,
    message:
      safeAvailable <= 0
        ? `محصول «${productName}» ناموجود است`
        : `موجودی «${productName}» کافی نیست (موجود: ${safeAvailable})`,
  });
}

export function shouldRestoreStockOnStatusChange(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return to === OrderStatus.CANCELLED && from !== OrderStatus.CANCELLED;
}

/** Stable lock order to reduce deadlock risk when decrementing several products. */
export function sortedProductIds(ids: Iterable<number>): number[] {
  return [...ids].sort((a, b) => a - b);
}

export async function decrementShopStockAtomic(
  tx: Prisma.TransactionClient,
  productId: number,
  quantity: number,
  productName: string,
): Promise<void> {
  const qty = assertPositiveIntQuantity(quantity);
  const updated = await tx.product.updateMany({
    where: {
      id: productId,
      isActive: true,
      stock: { gte: qty },
    },
    data: { stock: { decrement: qty } },
  });
  if (updated.count !== 1) {
    const again = await tx.product.findUnique({
      where: { id: productId },
      select: { stock: true, name: true },
    });
    throw insufficientStockException(again?.name ?? productName, again?.stock ?? 0);
  }
}

export async function restoreShopOrderStock(
  tx: Prisma.TransactionClient,
  items: { productId: number; quantity: number }[],
): Promise<void> {
  for (const item of items) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }
}
