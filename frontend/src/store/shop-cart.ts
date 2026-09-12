import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { multiplyRial, sumRial } from '@/lib/orders'

export type ShopCartItem = {
  productId: number
  title: string
  price: string
  image: string | null
  quantity: number
  maxStock?: number
  quoteRequired?: boolean
}

export type CatalogStockProduct = {
  id: number
  stock?: number | null
  inStock?: boolean
}

type ShopCartState = {
  items: ShopCartItem[]
  addItem: (item: Omit<ShopCartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: number) => void
  increase: (productId: number) => void
  decrease: (productId: number) => void
  setQuantity: (productId: number, quantity: number) => void
  syncFromCatalog: (products: CatalogStockProduct[]) => void
  clearCart: () => void
}

export function clampShopQty(quantity: number, maxStock?: number) {
  const next = Math.max(0, Math.min(99, Math.floor(quantity)))
  if (maxStock != null && Number.isFinite(maxStock)) {
    return Math.min(next, Math.max(0, Math.floor(maxStock)))
  }
  return next
}

export function applyCatalogStockToItems(
  items: ShopCartItem[],
  products: CatalogStockProduct[],
): ShopCartItem[] {
  const byId = new Map(products.map((product) => [product.id, product]))
  return items.flatMap((item) => {
    const product = byId.get(item.productId)
    if (!product) return []
    const stockKnown =
      typeof product.inStock === 'boolean' || typeof product.stock === 'number'
    if (!stockKnown) return [item]
    const maxStock =
      typeof product.stock === 'number' ? Math.max(0, Math.floor(product.stock)) : product.inStock ? 99 : 0
    const inStock = product.inStock ?? maxStock > 0
    if (!inStock || maxStock < 1) return []
    const quantity = clampShopQty(item.quantity, maxStock)
    if (quantity < 1) return []
    return [{ ...item, maxStock, quantity }]
  })
}

export const useShopCart = create<ShopCartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const existing = get().items.find((row) => row.productId === item.productId)
        const addQty = item.quantity ?? 1
        if (!existing) {
          const quantity = clampShopQty(addQty, item.maxStock)
          if (quantity < 1) return
          set({
            items: [
              ...get().items,
              {
                productId: item.productId,
                title: item.title,
                price: item.price,
                image: item.image ?? null,
                quantity,
                maxStock: item.maxStock,
                quoteRequired: Boolean(item.quoteRequired),
              },
            ],
          })
          return
        }
        const maxStock = item.maxStock ?? existing.maxStock
        const quantity = clampShopQty(existing.quantity + addQty, maxStock)
        if (quantity < 1) {
          set({ items: get().items.filter((row) => row.productId !== item.productId) })
          return
        }
        set({
          items: get().items.map((row) =>
            row.productId === item.productId
              ? {
                  ...row,
                  quantity,
                  maxStock,
                  quoteRequired: item.quoteRequired ?? row.quoteRequired,
                }
              : row,
          ),
        })
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((row) => row.productId !== productId) })
      },
      increase: (productId) => {
        const existing = get().items.find((row) => row.productId === productId)
        if (!existing) return
        const quantity = clampShopQty(existing.quantity + 1, existing.maxStock)
        set({
          items: get().items.map((row) =>
            row.productId === productId ? { ...row, quantity } : row,
          ),
        })
      },
      decrease: (productId) => {
        const existing = get().items.find((row) => row.productId === productId)
        if (!existing) return
        const quantity = clampShopQty(existing.quantity - 1, existing.maxStock)
        if (quantity < 1) {
          set({ items: get().items.filter((row) => row.productId !== productId) })
          return
        }
        set({
          items: get().items.map((row) =>
            row.productId === productId ? { ...row, quantity } : row,
          ),
        })
      },
      setQuantity: (productId, quantity) => {
        const existing = get().items.find((row) => row.productId === productId)
        if (!existing) return
        const next = clampShopQty(quantity, existing.maxStock)
        if (next < 1) {
          set({ items: get().items.filter((row) => row.productId !== productId) })
          return
        }
        set({
          items: get().items.map((row) =>
            row.productId === productId ? { ...row, quantity: next } : row,
          ),
        })
      },
      syncFromCatalog: (products) => {
        set({ items: applyCatalogStockToItems(get().items, products) })
      },
      clearCart: () => set({ items: [] }),
    }),
    { name: 'doocard-shop-cart' },
  ),
)

export function cartItemCount(items: ShopCartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function cartRequiresQuote(items: ShopCartItem[]): boolean {
  return items.some((item) => item.quoteRequired)
}

export function cartTotalRial(items: ShopCartItem[]): string {
  if (cartRequiresQuote(items)) return "0"
  return sumRial(items.map((item) => multiplyRial(item.price, item.quantity)))
}
