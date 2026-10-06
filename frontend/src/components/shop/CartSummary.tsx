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
      className="glass-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-accent px-4 text-sm font-semibold text-foreground backdrop-blur-md hover:border-border hover:bg-accent"
    >
      <ShoppingBag className="h-4 w-4" />
      سبد خرید
      {count > 0 ? (
        <span className="rounded-full border border-border bg-accent px-2 py-0.5 text-xs text-foreground">{count}</span>
      ) : null}
      {count > 0 ? (
        <span className="hidden text-xs font-normal text-foreground sm:inline">
          {quoteRequired ? "نیازمند استعلام" : formatTomansFromRial(total)}
        </span>
      ) : null}
    </button>
  )
}
