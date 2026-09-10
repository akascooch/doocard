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
}

type ShopCartState = {
  items: ShopCartItem[]
  addItem: (item: Omit<ShopCartItem, 'quantity'> & { quantity?: number }) => void
  removeItem: (productId: number) => void
  increase: (productId: number) => void
  decrease: (productId: number) => void
  setQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
}

function clampQty(quantity: number, maxStock?: number) {
  const next = Math.max(0, Math.min(99, Math.floor(quantity)))
  if (maxStock != null && Number.isFinite(maxStock)) {
    return Math.min(next, Math.max(0, maxStock))
  }
  return next
}

export const useShopCart = create<ShopCartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => {
        const existing = get().items.find((row) => row.productId === item.productId)
        const addQty = item.quantity ?? 1
        if (!existing) {
          const quantity = clampQty(addQty, item.maxStock)
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
              },
            ],
          })
          return
        }
        const quantity = clampQty(existing.quantity + addQty, existing.maxStock ?? item.maxStock)
        if (quantity < 1) {
          set({ items: get().items.filter((row) => row.productId !== item.productId) })
          return
        }
        set({
          items: get().items.map((row) =>
            row.productId === item.productId ? { ...row, quantity } : row,
          ),
        })
      },
      removeItem: (productId) => {
        set({ items: get().items.filter((row) => row.productId !== productId) })
      },
      increase: (productId) => {
        const existing = get().items.find((row) => row.productId === productId)
        if (!existing) return
        const quantity = clampQty(existing.quantity + 1, existing.maxStock)
        set({
          items: get().items.map((row) =>
            row.productId === productId ? { ...row, quantity } : row,
          ),
        })
      },
      decrease: (productId) => {
        const existing = get().items.find((row) => row.productId === productId)
        if (!existing) return
        const quantity = clampQty(existing.quantity - 1, existing.maxStock)
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
        const next = clampQty(quantity, existing.maxStock)
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
      clearCart: () => set({ items: [] }),
    }),
    { name: 'doocard-shop-cart' },
  ),
)

export function cartItemCount(items: ShopCartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

export function cartTotalRial(items: ShopCartItem[]): string {
  return sumRial(items.map((item) => multiplyRial(item.price, item.quantity)))
}
