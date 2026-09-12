import { isBackInStockTransition, backInStockTransitions } from './stock-transition.util';

describe('stock-transition.util', () => {
  it('triggers only on 0 (or below) to available', () => {
    expect(isBackInStockTransition(0, 5)).toBe(true);
    expect(isBackInStockTransition(-1, 1)).toBe(true);
    expect(isBackInStockTransition(2, 5)).toBe(false);
    expect(isBackInStockTransition(0, 0)).toBe(false);
    expect(isBackInStockTransition(1, 0)).toBe(false);
  });

  it('filters a restock batch', () => {
    expect(
      backInStockTransitions([
        { productId: 1, previousStock: 0, nextStock: 5 },
        { productId: 2, previousStock: 2, nextStock: 5 },
      ]),
    ).toEqual([{ productId: 1, previousStock: 0, nextStock: 5 }]);
  });
});
