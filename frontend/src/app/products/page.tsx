"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Package } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LandingHeader } from "@/components/landing/LandingHeader"
import { formatTomansFromRial } from "@/lib/money"
import { landingBookHref, readAuthToken } from "@/lib/landing"

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
}

function truncate(text: string | null, max = 90) {
  if (!text) return ""
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trim()}…`
}

export default function PublicProductsPage() {
  const [bookHref, setBookHref] = useState("/register")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categories, setCategories] = useState<PublicCategory[]>([])
  const [products, setProducts] = useState<PublicProduct[]>([])
  const [search, setSearch] = useState("")
  const [categoryId, setCategoryId] = useState<number | null>(null)

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
        setCategories(data.categories || [])
        setProducts(data.products || [])
        setError(null)
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        setError("بارگذاری فروشگاه با خطا مواجه شد")
        setProducts([])
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

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
    <div className="min-h-screen bg-black text-white">
      <LandingHeader bookHref={bookHref} />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-28 sm:px-6 lg:px-8">
        <p className="text-xs tracking-[0.35em] text-zinc-500">STORE</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">فروشگاه دوکارد</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
          محصولات منتخب سالن. قیمت برخی اقلام فقط در سالن اعلام می‌شود.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجوی محصول..."
            className="border-white/15 bg-transparent text-white placeholder:text-zinc-500 sm:max-w-sm"
          />
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
          <div className="flex items-center justify-center py-24 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : error ? (
          <p className="mt-12 text-sm text-red-400">{error}</p>
        ) : visible.length === 0 ? (
          <p className="mt-12 text-sm text-zinc-500">محصولی برای نمایش نیست.</p>
        ) : (
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((product) => {
              const image = product.images[0]
              const showPrice = product.priceVisible && product.priceRial != null
              return (
                <Card
                  key={product.id}
                  className="overflow-hidden border-white/10 bg-[#080808] text-white"
                >
                  <div className="relative aspect-[4/3] bg-zinc-900">
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-zinc-600">
                        <Package className="h-10 w-10" />
                      </div>
                    )}
                  </div>
                  <CardHeader className="space-y-2">
                    <Badge variant="outline" className="w-fit border-white/20 text-zinc-300">
                      {product.category.name}
                    </Badge>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {product.description ? (
                      <p className="text-sm leading-6 text-zinc-400">
                        {truncate(product.description)}
                      </p>
                    ) : null}
                    {showPrice ? (
                      <p className="text-sm font-semibold text-white">
                        {formatTomansFromRial(product.priceRial)}
                      </p>
                    ) : (
                      <p className="text-sm text-zinc-500">قیمت در سالن اعلام می‌شود</p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </main>
      <footer className="border-t border-white/10 px-4 py-8 text-sm text-zinc-400">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Link href="/" className="hover:text-white">
            بازگشت به صفحه اصلی
          </Link>
          <Link href="/products" className="text-white">
            فروشگاه
          </Link>
        </div>
      </footer>
    </div>
  )
}
