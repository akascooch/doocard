"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { api } from "@/lib/axios"
import { Pencil, Plus, Trash2 } from "lucide-react"

type Packaging = {
  id: number
  name: string
  unitLabel: string
  unitsPerPackage: number
  isActive: boolean
}

function apiErrorMessage(error: unknown, fallback: string) {
  const data = (error as { response?: { data?: { message_fa?: string; message?: string | string[] } } })
    ?.response?.data
  if (typeof data?.message_fa === "string") return data.message_fa
  if (typeof data?.message === "string") return data.message
  if (Array.isArray(data?.message)) return data.message[0]
  return fallback
}

export function ProductPackagingManager({ productId }: { productId: number }) {
  const { toast } = useToast()
  const [items, setItems] = useState<Packaging[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [unitLabel, setUnitLabel] = useState("عدد")
  const [unitsPerPackage, setUnitsPerPackage] = useState(1)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Packaging | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/products/${productId}/packagings`)
      setItems(res.data || [])
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "بارگذاری بسته‌بندی ناموفق بود"),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [productId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setEditingId(null)
    setName("")
    setUnitLabel("عدد")
    setUnitsPerPackage(1)
  }

  const handleSave = async () => {
    if (name.trim().length < 1 || unitsPerPackage < 1) {
      toast({ title: "خطا", description: "نام و ضریب تبدیل الزامی است", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        unitLabel: unitLabel.trim() || "عدد",
        unitsPerPackage,
      }
      if (editingId) {
        await api.patch(`/products/${productId}/packagings/${editingId}`, payload)
        toast({ title: "موفق", description: "بسته‌بندی به‌روزرسانی شد" })
      } else {
        await api.post(`/products/${productId}/packagings`, payload)
        toast({ title: "موفق", description: "بسته‌بندی اضافه شد" })
      }
      resetForm()
      await load()
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "ذخیره بسته‌بندی ناموفق بود"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      const res = await api.delete(`/products/${productId}/packagings/${deleteTarget.id}`)
      setDeleteTarget(null)
      if (res.data?.deleted) {
        toast({ title: "موفق", description: "بسته‌بندی حذف شد" })
      } else {
        toast({
          title: "بایگانی شد",
          description: "این بسته‌بندی در تراکنش‌های قبلی استفاده شده و فقط غیرفعال شد.",
        })
      }
      await load()
    } catch (error) {
      toast({
        title: "خطا",
        description: apiErrorMessage(error, "حذف بسته‌بندی ناموفق بود"),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
      <Label>بسته‌بندی‌ها</Label>
      {loading ? (
        <p className="text-sm text-muted-foreground">در حال بارگذاری...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">هنوز بسته‌بندی تعریف نشده است.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {item.name}
                  {!item.isActive ? " (بایگانی)" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.unitLabel} · هر بسته {item.unitsPerPackage} واحد پایه
                </p>
              </div>
              {item.isActive ? (
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`ویرایش ${item.name}`}
                    title="ویرایش"
                    onClick={() => {
                      setEditingId(item.id)
                      setName(item.name)
                      setUnitLabel(item.unitLabel)
                      setUnitsPerPackage(item.unitsPerPackage)
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="text-red-600"
                    aria-label={`حذف ${item.name}`}
                    title="حذف"
                    onClick={() => setDeleteTarget(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input placeholder="نام بسته‌بندی" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="واحد" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} />
        <Input
          type="number"
          min={1}
          placeholder="ضریب تبدیل"
          value={unitsPerPackage}
          onChange={(e) => setUnitsPerPackage(Math.max(1, Number(e.target.value) || 1))}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => void handleSave()} disabled={saving}>
          <Plus className="h-4 w-4" />
          {editingId ? "به‌روزرسانی بسته‌بندی" : "افزودن بسته‌بندی"}
        </Button>
        {editingId ? (
          <Button type="button" variant="ghost" onClick={resetForm}>
            انصراف
          </Button>
        ) : null}
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف بسته‌بندی</AlertDialogTitle>
            <AlertDialogDescription>
              بسته‌بندی «{deleteTarget?.name}» با واحد «{deleteTarget?.unitLabel}» حذف شود؟
              اگر در موجودی یا فاکتور استفاده شده باشد، حذف قطعی نمی‌شود و فقط بایگانی می‌گردد.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
