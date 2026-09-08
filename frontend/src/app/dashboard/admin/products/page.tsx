"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import MoneyInput from "@/components/ui/MoneyInput"
import { useToast } from "@/components/ui/use-toast"
import { getCurrentUser } from "@/lib/auth"
import { getDashboardHomePath } from "@/lib/user-roles"
import { api } from "@/lib/axios"
import { formatTomansFromRial } from "@/lib/money"
import { Edit, Package, Plus, Search, Trash2, Warehouse } from "lucide-react"

interface ProductCategory {
  id: number
  name: string
  isActive: boolean
}

interface ProductRow {
  id: number
  name: string
  sku: string | null
  barcode: string | null
  description: string | null
  priceRial: string
  isPriceVisible: boolean
  stock: number
  lowStockAlert: number | null
  isActive: boolean
  images: string[]
  category: ProductCategory | null
  categoryId: number | null
}

const emptyForm = {
  name: "",
  sku: "",
  barcode: "",
  description: "",
  priceRial: 0,
  isPriceVisible: false,
  lowStockAlert: "" as string,
  categoryId: "" as string,
  images: [] as string[],
}

function apiErrorMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { message_fa?: string; message?: string | string[] } } })
    ?.response?.data
  if (typeof data?.message_fa === "string") return data.message_fa
  if (typeof data?.message === "string") return data.message
  if (Array.isArray(data?.message)) return data.message[0]
  return fallback
}

export default function AdminProductsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ProductRow | null>(null)
  const [formData, setFormData] = useState(emptyForm)
  const [uploading, setUploading] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser && currentUser.role !== "ADMIN") {
      window.location.href = getDashboardHomePath(currentUser.role)
      return
    }
    void loadAll()
  }, [])

  const loadAll = async () => {
    try {
      setLoading(true)
      const [productsRes, categoriesRes] = await Promise.all([
        api.get("/products", { params: { limit: 100 } }),
        api.get("/products/categories"),
      ])
      setProducts(productsRes.data.data || [])
      setCategories(categoriesRes.data || [])
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "خطا در بارگذاری محصولات"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setFormData(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (product: ProductRow) => {
    setEditing(product)
    setFormData({
      name: product.name,
      sku: product.sku || "",
      barcode: product.barcode || "",
      description: product.description || "",
      priceRial: Number(product.priceRial),
      isPriceVisible: product.isPriceVisible,
      lowStockAlert: product.lowStockAlert == null ? "" : String(product.lowStockAlert),
      categoryId: product.categoryId ? String(product.categoryId) : "",
      images: product.images || [],
    })
    setDialogOpen(true)
  }

  const uploadImage = async (file: File) => {
    const fd = new FormData()
    fd.append("file", file)
    const res = await api.post("/products/upload", fd)
    return res.data.url as string
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: "خطا", description: "نام محصول الزامی است", variant: "destructive" })
      return
    }
    const payload = {
      name: formData.name.trim(),
      sku: formData.sku.trim() || undefined,
      barcode: formData.barcode.trim() || undefined,
      description: formData.description.trim() || undefined,
      priceRial: formData.priceRial,
      isPriceVisible: formData.isPriceVisible,
      lowStockAlert: formData.lowStockAlert === "" ? undefined : Number(formData.lowStockAlert),
      categoryId: formData.categoryId ? Number(formData.categoryId) : undefined,
      images: formData.images,
    }
    try {
      if (editing) {
        await api.patch(`/products/${editing.id}`, payload)
        toast({ title: "موفق", description: "محصول به‌روزرسانی شد" })
      } else {
        await api.post("/products", payload)
        toast({ title: "موفق", description: "محصول اضافه شد" })
      }
      setDialogOpen(false)
      await loadAll()
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "خطا در ذخیره محصول"),
        variant: "destructive",
      })
    }
  }

  const handleDeactivate = async (id: number) => {
    if (!confirm("این محصول غیرفعال شود؟")) return
    try {
      await api.delete(`/products/${id}`)
      toast({ title: "موفق", description: "محصول غیرفعال شد" })
      await loadAll()
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "خطا در غیرفعال‌سازی"),
        variant: "destructive",
      })
    }
  }

  const togglePriceVisible = async (product: ProductRow, value: boolean) => {
    try {
      await api.patch(`/products/${product.id}`, { isPriceVisible: value })
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isPriceVisible: value } : p)),
      )
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "خطا در به‌روزرسانی نمایش قیمت"),
        variant: "destructive",
      })
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const res = await api.post("/products/categories", { name: newCategoryName.trim() })
      setCategories((prev) => [...prev, res.data])
      setFormData((prev) => ({ ...prev, categoryId: String(res.data.id) }))
      setNewCategoryName("")
      toast({ title: "موفق", description: "دسته‌بندی اضافه شد" })
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "خطا در ایجاد دسته"),
        variant: "destructive",
      })
    }
  }

  const filtered = products.filter((p) => {
    const q = searchTerm.trim().toLowerCase()
    const matchesSearch =
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q))
    const matchesCategory = !categoryFilter || String(p.categoryId) === categoryFilter
    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">مدیریت محصولات</h1>
          <p className="mt-2 text-muted-foreground">کاتالوگ فروشگاه و وضعیت موجودی</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/admin/products/inventory">
            <Button variant="outline">
              <Warehouse className="ml-2 h-4 w-4" />
              موجودی
            </Button>
          </Link>
          <Button className="doocard-gradient hover:opacity-90" onClick={openCreate}>
            <Plus className="ml-2 h-4 w-4" />
            محصول جدید
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو نام، SKU یا بارکد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">همه دسته‌ها</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.isActive ? " (غیرفعال)" : ""}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            فهرست محصولات
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="p-2 font-medium">نام</th>
                <th className="p-2 font-medium">دسته</th>
                <th className="p-2 font-medium">قیمت</th>
                <th className="p-2 font-medium">موجودی</th>
                <th className="p-2 font-medium">نمایش قیمت</th>
                <th className="p-2 font-medium">وضعیت</th>
                <th className="p-2 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const low =
                  product.lowStockAlert != null && product.stock <= product.lowStockAlert
                return (
                  <tr key={product.id} className="border-b last:border-0">
                    <td className="p-2 font-medium">{product.name}</td>
                    <td className="p-2">{product.category?.name || "—"}</td>
                    <td className="p-2">{formatTomansFromRial(product.priceRial)}</td>
                    <td className="p-2">
                      <Badge variant={low ? "destructive" : "secondary"}>
                        {product.stock}
                        {low ? " · کم" : ""}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Switch
                        checked={product.isPriceVisible}
                        onCheckedChange={(v) => void togglePriceVisible(product, v)}
                      />
                    </td>
                    <td className="p-2">
                      <Badge variant={product.isActive ? "default" : "outline"}>
                        {product.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {product.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600"
                            onClick={() => void handleDeactivate(product.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">محصولی یافت نشد</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{editing ? "ویرایش محصول" : "افزودن محصول جدید"}</DialogTitle>
            <DialogDescription>قیمت را به تومان وارد کنید؛ ذخیره به ریال انجام می‌شود.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>نام محصول *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>دسته‌بندی</Label>
              <select
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">بدون دسته</option>
                {categories
                  .filter((c) => c.isActive || String(c.id) === formData.categoryId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <div className="flex gap-2">
                <Input
                  placeholder="دسته جدید"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={() => void handleCreateCategory()}>
                  افزودن
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>بارکد</Label>
              <Input
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              />
            </div>
            <MoneyInput
              value={formData.priceRial}
              onChange={(rials) => setFormData({ ...formData, priceRial: rials })}
              label="قیمت *"
              required
            />
            <div className="space-y-2">
              <Label>هشدار موجودی کم</Label>
              <Input
                type="number"
                min={0}
                value={formData.lowStockAlert}
                onChange={(e) => setFormData({ ...formData, lowStockAlert: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>توضیحات</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Switch
                checked={formData.isPriceVisible}
                onCheckedChange={(v) => setFormData({ ...formData, isPriceVisible: v })}
              />
              <Label>نمایش قیمت در کاتالوگ عمومی</Label>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>تصاویر</Label>
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    setUploading(true)
                    const url = await uploadImage(file)
                    setFormData((prev) => ({ ...prev, images: [...prev.images, url] }))
                  } catch (error) {
                    toast({
                      title: "خطا",
                      description: apiErrorMessage(error, "آپلود تصویر ناموفق بود"),
                      variant: "destructive",
                    })
                  } finally {
                    setUploading(false)
                    e.target.value = ""
                  }
                }}
              />
              <div className="flex flex-wrap gap-2">
                {formData.images.map((url) => (
                  <button
                    key={url}
                    type="button"
                    className="relative h-16 w-16 overflow-hidden rounded-md border"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        images: prev.images.filter((u) => u !== url),
                      }))
                    }
                    title="حذف تصویر"
                  >
                    {/* product thumbnail */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              لغو
            </Button>
            <Button className="doocard-gradient hover:opacity-90" onClick={() => void handleSave()}>
              {editing ? "به‌روزرسانی" : "افزودن"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
