"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { Loader2, Minus, Plus, Trash2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { normalizeIranMobileClient } from "@/components/customers/QuickRegisterCustomerForm"
import { formatTomansFromRial } from "@/lib/money"
import { parseFetchError, SHOP_CARD_TO_CARD, type ShopOrder } from "@/lib/orders"
import { cartTotalRial, useShopCart } from "@/store/shop-cart"

const IRAN_MOBILE_RE = /^09\d{9}$/
const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp"]

export function CheckoutForm({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const items = useShopCart((s) => s.items)
  const increase = useShopCart((s) => s.increase)
  const decrease = useShopCart((s) => s.decrease)
  const removeItem = useShopCart((s) => s.removeItem)
  const clearCart = useShopCart((s) => s.clearCart)
  const total = cartTotalRial(items)

  const [customerName, setCustomerName] = useState("")
  const [customerPhone, setCustomerPhone] = useState("")
  const [customerAddress, setCustomerAddress] = useState("")
  const [customerNotes, setCustomerNotes] = useState("")
  const [receipt, setReceipt] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [successOrder, setSuccessOrder] = useState<ShopOrder | null>(null)

  useEffect(() => {
    if (!receipt) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(receipt)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [receipt])

  useEffect(() => {
    if (!open) {
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const canSubmit = useMemo(() => items.length > 0 && !submitting, [items.length, submitting])

  const resetForm = () => {
    setCustomerName("")
    setCustomerPhone("")
    setCustomerAddress("")
    setCustomerNotes("")
    setReceipt(null)
    setError(null)
    setSuccessOrder(null)
    setCopied(false)
  }

  const copyCardNumber = async () => {
    const value = SHOP_CARD_TO_CARD.cardNumber
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
      } else {
        const el = document.createElement("textarea")
        el.value = value
        el.setAttribute("readonly", "")
        el.style.position = "absolute"
        el.style.left = "-9999px"
        document.body.appendChild(el)
        el.select()
        document.execCommand("copy")
        document.body.removeChild(el)
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("کپی شماره کارت انجام نشد")
    }
  }

  const validate = (): string | null => {
    if (items.length === 0) return "سبد خرید خالی است"
    if (!customerName.trim() || customerName.trim().length < 2) return "نام الزامی است"
    const phone = normalizeIranMobileClient(customerPhone)
    if (!IRAN_MOBILE_RE.test(phone)) return "شماره موبایل معتبر نیست (مثال: 09121234567)"
    if (!receipt) return "تصویر رسید کارت‌به‌کارت الزامی است"
    if (!RECEIPT_TYPES.includes(receipt.type)) return "فقط فایل JPEG، PNG یا WebP مجاز است"
    if (receipt.size > 5 * 1024 * 1024) return "حجم تصویر حداکثر ۵ مگابایت است"
    return null
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    if (!receipt) return

    setSubmitting(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("customerName", customerName.trim())
      form.append("customerPhone", normalizeIranMobileClient(customerPhone))
      if (customerAddress.trim()) form.append("customerAddress", customerAddress.trim())
      if (customerNotes.trim()) form.append("customerNotes", customerNotes.trim())
      form.append(
        "items",
        JSON.stringify(items.map((item) => ({ productId: item.productId, quantity: item.quantity }))),
      )
      form.append("receipt", receipt)

      const res = await fetch("/api/orders", {
        method: "POST",
        body: form,
        credentials: "omit",
      })
      if (!res.ok) {
        throw new Error(await parseFetchError(res, "ثبت سفارش ناموفق بود"))
      }
      const order = (await res.json()) as ShopOrder
      clearCart()
      setSuccessOrder(order)
      setReceipt(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "ثبت سفارش ناموفق بود")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-white/10 bg-[#0c0c0c] text-white sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>تسویه کارت‌به‌کارت</DialogTitle>
          <DialogDescription className="text-zinc-400">
            سفارش پس از بررسی رسید توسط سالن تأیید می‌شود.
          </DialogDescription>
        </DialogHeader>

        {successOrder ? (
          <div className="space-y-4 text-sm">
            <p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-200">
              سفارش شما ثبت شد.
              {successOrder.orderNumber ? (
                <>
                  {" "}
                  شماره سفارش: <span className="font-semibold">{successOrder.orderNumber}</span>
                </>
              ) : null}
            </p>
            <Button
              type="button"
              className="w-full bg-white text-black hover:bg-zinc-200"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
            >
              بستن
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-md border border-white/15 bg-white/5 p-4 text-sm text-zinc-100">
              <p className="text-zinc-300">به نام</p>
              <p className="mt-1 text-base font-semibold">{SHOP_CARD_TO_CARD.ownerName}</p>
              <p className="mt-4 text-zinc-300">شماره کارت</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p dir="ltr" className="font-mono text-lg tracking-wide">
                  {SHOP_CARD_TO_CARD.cardNumberDisplay}
                </p>
                <button
                  type="button"
                  onClick={() => void copyCardNumber()}
                  aria-label="کپی شماره کارت"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-white/20 px-3 text-xs text-white hover:bg-white/10"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "کپی شد" : "کپی شماره کارت"}
                </button>
              </div>
              <p className="mt-3 leading-7 text-zinc-300">{SHOP_CARD_TO_CARD.instructions}</p>
            </div>

            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-zinc-500">سبد خرید خالی است.</p>
              ) : (
                items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 rounded-md border border-white/10 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">{item.title}</p>
                      <p className="text-xs text-zinc-500">
                        {formatTomansFromRial(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/15"
                        onClick={() => decrease(item.productId)}
                        aria-label="کاهش"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/15"
                        onClick={() => increase(item.productId)}
                        aria-label="افزایش"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center text-zinc-400 hover:text-red-400"
                        onClick={() => removeItem(item.productId)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
              {items.length > 0 ? (
                <p className="pt-1 text-sm font-semibold">جمع: {formatTomansFromRial(total)}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="shop-name" className="text-zinc-200">
                  نام و نام خانوادگی *
                </Label>
                <Input
                  id="shop-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="border-white/15 bg-transparent text-white"
                  maxLength={120}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shop-phone" className="text-zinc-200">
                  شماره موبایل *
                </Label>
                <Input
                  id="shop-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="border-white/15 bg-transparent text-white"
                  dir="ltr"
                  placeholder="0912xxxxxxx"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shop-address" className="text-zinc-200">
                  آدرس (اختیاری)
                </Label>
                <Textarea
                  id="shop-address"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="border-white/15 bg-transparent text-white"
                  rows={2}
                  maxLength={500}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shop-notes" className="text-zinc-200">
                  یادداشت (اختیاری)
                </Label>
                <Textarea
                  id="shop-notes"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="border-white/15 bg-transparent text-white"
                  rows={2}
                  maxLength={1000}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shop-receipt" className="text-zinc-200">
                  تصویر رسید *
                </Label>
                <Input
                  id="shop-receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="border-white/15 bg-transparent text-white file:text-white"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setReceipt(file)
                  }}
                />
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="پیش‌نمایش رسید"
                    className="mt-2 max-h-40 rounded-md object-contain"
                  />
                ) : null}
              </div>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-white text-black hover:bg-zinc-200"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              ثبت سفارش
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
