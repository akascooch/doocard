"use client"

import { ShoppingBag } from "lucide-react"
import { formatTomansFromRial } from "@/lib/money"
import { cartItemCount, cartTotalRial, useShopCart } from "@/store/shop-cart"

export function CartSummary({ onCheckout }: { onCheckout: () => void }) {
  const items = useShopCart((s) => s.items)
  const count = cartItemCount(items)
  const total = cartTotalRial(items)

  return (
    <button
      type="button"
      onClick={onCheckout}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/20 bg-white px-4 text-sm font-semibold text-black hover:bg-zinc-200"
    >
      <ShoppingBag className="h-4 w-4" />
      سبد خرید
      {count > 0 ? (
        <span className="rounded-full bg-black px-2 py-0.5 text-xs text-white">{count}</span>
      ) : null}
      {count > 0 ? (
        <span className="hidden text-xs font-normal text-zinc-600 sm:inline">
          {formatTomansFromRial(total)}
        </span>
      ) : null}
    </button>
  )
}
