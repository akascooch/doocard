"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LandingHeader } from "@/components/landing/LandingHeader"
import { CartSummary } from "@/components/shop/CartSummary"
import { CheckoutForm } from "@/components/shop/CheckoutForm"
import { formatTomansFromRial } from "@/lib/money"
import { landingBookHref, readAuthToken } from "@/lib/landing"
import { subscribeToProductWaitlist } from "@/lib/waitlist"
import { useShopCart } from "@/store/shop-cart"

type PublicCategory = { id: number; name: string }

type PublicProduct = {
  id: number
  name: string
  description: string | null
  images: string[]
  category: PublicCategory
  priceRial: string | null
  priceVisible: boolean
  isPriceVisible: boolean
  stock?: number
  inStock?: boolean
  stockStatus?: "IN_STOCK" | "OUT_OF_STOCK"
}

function catalogAvailability(product: PublicProduct): { inStock: boolean; stock?: number } {
  if (typeof product.inStock === "boolean") {
    return {
      inStock: product.inStock,
      stock: typeof product.stock === "number" ? Math.max(0, Math.floor(product.stock)) : undefined,
    }
  }
  if (typeof product.stock === "number") {
    const stock = Math.max(0, Math.floor(product.stock))
    return { inStock: stock > 0, stock }
  }
  return { inStock: true }
}

function truncate(text: string | null, max = 90) {
  if (!text) return ""
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trim()}…`
}

export default function PublicProductsPage() {
  const [bookHref, setBookHref] = useState("/book-appointment")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [waitlistBusyId, setWaitlistBusyId] = useState<number | null>(null)
  const [waitlistNote, setWaitlistNote] = useState<Record<number, string>>({})
  const addItem = useShopCart((s) => s.addItem)
  const syncFromCatalog = useShopCart((s) => s.syncFromCatalog)

  const requestWaitlist = async (productId: number) => {
    const token = readAuthToken()
    if (!token) {
      setWaitlistNote((prev) => ({
        ...prev,
        [productId]: "برای خبر شدن هنگام موجود شدن، وارد شوید.",
      }))
      return
    }
    setWaitlistBusyId(productId)
    try {
      await subscribeToProductWaitlist(productId, token)
      setWaitlistNote((prev) => ({ ...prev, [productId]: "ثبت شد. وقتی موجود شود خبرتان می‌کنیم." }))
    } catch (err) {
      setWaitlistNote((prev) => ({
        ...prev,
        [productId]: err instanceof Error ? err.message : "ثبت درخواست ناموفق بود",
      }))
    } finally {
      setWaitlistBusyId(null)
    }
  }

  useEffect(() => {
    setBookHref(landingBookHref(Boolean(readAuthToken())))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    fetch("/api/public/products", {
      signal: controller.signal,
      credentials: "omit",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("catalog"))))
      .then((data: { categories?: PublicCategory[]; products?: PublicProduct[] }) => {
        const nextProducts = data.products || []
        setCategories(data.categories || [])
        setProducts(nextProducts)
        syncFromCatalog(nextProducts)
        setError(null)
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError("بارگذاری فروشگاه با خطا مواجه شد")
        setProducts([])
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [syncFromCatalog])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((product) => {
      if (categoryId != null && product.category.id !== categoryId) return false
      if (!q) return true
      const hay = `${product.name} ${product.description || ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [products, search, categoryId])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LandingHeader bookHref={bookHref} />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <p className="text-xs tracking-[0.35em] text-foreground">STORE</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">فروشگاه دوکارد</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground">
          محصولات منتخب سالن. قیمت برخی اقلام فقط در سالن اعلام می‌شود.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی محصول..."
            className="border-border bg-transparent text-foreground placeholder:text-card-foreground sm:max-w-sm"
          />
          <CartSummary onCheckout={() => setCheckoutOpen(true)} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategoryId(null)}>
            <Badge
              variant={categoryId == null ? "default" : "outline"}
              className="cursor-pointer px-3 py-1"
            >
              همه
            </Badge>
          </button>
          {categories.map((cat) => (
            <button type="button" key={cat.id} onClick={() => setCategoryId(cat.id)}>
              <Badge
                variant={categoryId === cat.id ? "default" : "outline"}
                className="cursor-pointer px-3 py-1"
              >
                {cat.name}
              </Badge>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 text-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <p className="mt-12 text-sm text-destructive">{error}</p>
        ) : visible.length === 0 ? (
          <p className="mt-12 text-sm text-foreground">محصولی برای نمایش نیست.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((product) => {
              const image = product.images[0]
              const showPrice = product.priceVisible && product.priceRial != null
              const { inStock, stock } = catalogAvailability(product)
              const canAdd = inStock
              const quoteRequired = !showPrice
              return (
                <Card
                  key={product.id}
                  data-cy={`product-card-${product.id}`}
                  data-stock={inStock ? "in" : "out"}
                  data-quote={quoteRequired ? "yes" : "no"}
                  className="overflow-hidden border-border bg-card text-foreground"
                >
                  <div className="relative aspect-[4/3] bg-card">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-foreground">
                        <Package className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <CardHeader className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="w-fit border-border text-foreground">
                        {product.category.name}
                      </Badge>
                      {!inStock ? (
                        <Badge
                          variant="outline"
                          className="w-fit border-border bg-accent text-foreground"
                        >
                          ناموجود
                        </Badge>
                      ) : quoteRequired ? (
                        <Badge
                          variant="outline"
                          className="w-fit border-border bg-primary text-foreground"
                        >
                          نیازمند استعلام قیمت
                        </Badge>
                      ) : null}
                    </div>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {product.description ? (
                      <p className="text-sm leading-6 text-foreground">
                        {truncate(product.description)}
                      </p>
                    ) : null}
                    {showPrice ? (
                      <p className="text-sm font-semibold text-foreground">
                        {formatTomansFromRial(product.priceRial)}
                      </p>
                    ) : (
                      <p className="text-sm text-foreground">تماس جهت استعلام</p>
                    )}
                    <button
                      type="button"
                      data-cy={
                        !inStock
                          ? "product-out-of-stock"
                          : quoteRequired
                            ? "product-add-quote"
                            : "product-add-fixed"
                      }
                      disabled={!canAdd}
                      onClick={() => {
                        if (!inStock) return
                        addItem({
                          productId: product.id,
                          title: product.name,
                          price: showPrice && product.priceRial ? product.priceRial : "0",
                          image: image || null,
                          maxStock: stock,
                          quoteRequired,
                        })
                      }}
                      className="glass-button inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-semibold text-card-foreground hover:border-ring hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                      data-glass=""
                    >
                      {!inStock ? "ناموجود" : quoteRequired ? "افزودن برای استعلام" : "افزودن به سبد"}
                    </button>
                    {!inStock ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          data-cy="product-waitlist"
                          disabled={waitlistBusyId === product.id || waitlistNote[product.id]?.startsWith("ثبت شد")}
                          onClick={() => void requestWaitlist(product.id)}
                          className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border px-4 text-sm text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {waitlistBusyId === product.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : waitlistNote[product.id]?.startsWith("ثبت شد") ? (
                            "ثبت شد"
                          ) : (
                            "خبرم کنید"
                          )}
                        </button>
                        {waitlistNote[product.id] ? (
                          <p className="text-xs text-foreground">
                            {waitlistNote[product.id]}{" "}
                            {waitlistNote[product.id].includes("وارد شوید") ? (
                              <Link href="/login" className="text-foreground underline">
                                ورود
                              </Link>
                            ) : null}
                          </p>
                        ) : (
                          <p className="text-xs text-foreground">این محصول در حال حاضر موجود نیست.</p>
                        )}
                      </div>
                    ) : quoteRequired ? (
                      <p className="text-xs text-foreground">پس از ثبت درخواست، کارشناسان قیمت نهایی را اعلام می‌کنند.</p>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
      <footer className="border-t border-border px-4 py-8 text-sm text-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="hover:text-foreground">
            بازگشت به صفحه اصلی
          </Link>
          <Link href="/products" className="text-foreground">
            فروشگاه
          </Link>
        </div>
      </footer>
      <CheckoutForm open={checkoutOpen} onOpenChange={setCheckoutOpen} />
    </div>
  )
}
