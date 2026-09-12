export type StockTransition = {
  productId: number;
  previousStock: number;
  nextStock: number;
};

/** True only on the out-of-stock → available edge (0 or negative → >0). */
export function isBackInStockTransition(previousStock: number, nextStock: number): boolean {
  return previousStock <= 0 && nextStock > 0;
}

export function backInStockTransitions(rows: StockTransition[]): StockTransition[] {
  return rows.filter((row) => isBackInStockTransition(row.previousStock, row.nextStock));
}
