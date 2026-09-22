"use client"

import { ShoppingBag } from "lucide-react"
import { formatTomansFromRial } from "@/lib/money"
import { cartItemCount, cartRequiresQuote, cartTotalRial, useShopCart } from "@/store/shop-cart"

export function CartSummary({ onCheckout }: { onCheckout: () => void }) {
  const items = useShopCart((s) => s.items)
  const count = cartItemCount(items)
  const total = cartTotalRial(items)
  const quoteRequired = cartRequiresQuote(items)

  return (
    <button
      type="button"
      data-cy="open-cart"
      data-glass=""
      onClick={onCheckout}
      className="glass-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-zinc-100 backdrop-blur-md hover:border-white/25 hover:bg-white/10"
    >
      <ShoppingBag className="h-4 w-4" />
      سبد خرید
      {count > 0 ? (
        <span className="rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-xs text-white">{count}</span>
      ) : null}
      {count > 0 ? (
        <span className="hidden text-xs font-normal text-zinc-400 sm:inline">
          {quoteRequired ? "نیازمند استعلام" : formatTomansFromRial(total)}
        </span>
      ) : null}
    </button>
  )
}
