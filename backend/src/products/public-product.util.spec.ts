import {
  availablePublicStock,
  publicStockStatus,
  toPublicCatalogProduct,
} from './public-product.util';

describe('public-product.util', () => {
  it('never exposes negative stock and marks zero as out of stock', () => {
    expect(availablePublicStock(-3)).toBe(0);
    expect(availablePublicStock(2.9)).toBe(2);
    expect(publicStockStatus(0)).toBe('OUT_OF_STOCK');
    expect(publicStockStatus(4)).toBe('IN_STOCK');
  });

  it('hides price when not visible and still reports stock', () => {
    const row = toPublicCatalogProduct({
      id: 1,
      name: 'Gel',
      description: null,
      images: [],
      priceRial: 1000n,
      isPriceVisible: false,
      stock: 7,
      category: { id: 2, name: 'Care' },
    });
    expect(row.priceRial).toBeNull();
    expect(row.stock).toBe(7);
    expect(row.inStock).toBe(true);
    expect(row.stockStatus).toBe('IN_STOCK');
    expect(row).not.toHaveProperty('sku');
    expect(row).not.toHaveProperty('lowStockAlert');
    expect(row).not.toHaveProperty('unitCostRial');
  });
});
