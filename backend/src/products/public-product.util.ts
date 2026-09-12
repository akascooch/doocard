export const PUBLIC_STOCK_STATUSES = ['IN_STOCK', 'OUT_OF_STOCK'] as const;
export type PublicStockStatus = (typeof PUBLIC_STOCK_STATUSES)[number];

export function availablePublicStock(stock: number | null | undefined): number {
  const n = Number(stock);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function publicStockStatus(stock: number | null | undefined): PublicStockStatus {
  return availablePublicStock(stock) > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK';
}

export function toPublicCatalogProduct(row: {
  id: number;
  name: string;
  description: string | null;
  images: string[];
  priceRial: bigint | string;
  isPriceVisible: boolean;
  stock: number;
  category: { id: number; name: string };
}) {
  const available = availablePublicStock(row.stock);
  const priceVisible = row.isPriceVisible;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    images: row.images,
    category: {
      id: row.category.id,
      name: row.category.name,
    },
    priceRial: priceVisible ? String(row.priceRial) : null,
    priceVisible,
    isPriceVisible: priceVisible,
    stock: available,
    inStock: available > 0,
    stockStatus: publicStockStatus(available),
  };
}
