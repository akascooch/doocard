"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { ImagePlus, RefreshCw, Save, Trash2, Upload } from "lucide-react"
import {
  parseWorkingHours,
  stringifyWorkingHours,
  type LandingHours,
  type LandingSlide,
} from "@/lib/landing"

type HomepageDetails = {
  id?: number
  about?: string
  team?: string
  products?: string
  trainings?: string
  testimonials?: string
  contact?: string
  heroTitle?: string
  heroSubtitle?: string
  phone?: string
  address?: string
  instagramUrl?: string
  workingHours?: string
}

type StaffRow = {
  id: number
  name: string
  specialty?: string | null
  avatarUrl?: string | null
  bio?: string | null
  displayTitle?: string | null
  showOnLanding: boolean
  landingSortOrder: number
}

function authHeaders(json = false): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (json) headers["Content-Type"] = "application/json"
  return headers
}

async function readError(res: Response) {
  try {
    const body = await res.json()
    return body?.message || body?.error || res.statusText
  } catch {
    return res.statusText
  }
}

export default function AdminHomepagePage() {
  const { toast } = useToast()
  const [tab, setTab] = useState("hero")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [details, setDetails] = useState<HomepageDetails>({})
  const [hours, setHours] = useState<LandingHours>(parseWorkingHours(null))
  const [slides, setSlides] = useState<LandingSlide[]>([])
  const [staff, setStaff] = useState<StaffRow[]>([])
  const [uploading, setUploading] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const [detailsRes, slidesRes, staffRes] = await Promise.all([
        fetch("/api/homepage"),
        fetch("/api/homepage/slides", { headers: authHeaders() }),
        fetch("/api/homepage/staff", { headers: authHeaders() }),
      ])
      if (!detailsRes.ok) throw new Error("بارگذاری اطلاعات عمومی ناموفق بود")
      const detailsData = (await detailsRes.json()) as HomepageDetails
      setDetails(detailsData)
      setHours(parseWorkingHours(detailsData.workingHours))

      if (slidesRes.ok) {
        setSlides(await slidesRes.json())
      } else {
        toast({ title: "خطا", description: "بارگذاری اسلایدها ناموفق بود", variant: "destructive" })
      }
      if (staffRes.ok) {
        setStaff(await staffRes.json())
      } else {
        toast({ title: "خطا", description: "بارگذاری تیم ناموفق بود", variant: "destructive" })
      }
    } catch (error) {
      console.error(error)
      toast({
        title: "خطا",
        description: "خطا در بارگذاری اطلاعات صفحه اصلی",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData()
    fd.append("file", file)
    const res = await fetch("/api/homepage/upload", {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    })
    if (!res.ok) throw new Error(await readError(res))
    const data = await res.json()
    if (!data?.url) throw new Error("آدرس تصویر دریافت نشد")
    return data.url as string
  }

  const saveHero = async () => {
    try {
      setSaving(true)
      const payload = {
        about: details.about || "",
        team: details.team || "",
        products: details.products || "",
        trainings: details.trainings || "",
        testimonials: details.testimonials || "",
        contact: details.contact || "",
        heroTitle: details.heroTitle || "",
        heroSubtitle: details.heroSubtitle || "",
        phone: details.phone || "",
        address: details.address || "",
        instagramUrl: details.instagramUrl || "",
        workingHours: stringifyWorkingHours(hours),
      }
      const res = await fetch("/api/homepage", {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await readError(res))
      toast({ title: "موفقیت", description: "اطلاعات هیرو و عمومی ذخیره شد" })
      await loadAll()
    } catch (error) {
      toast({
        title: "خطا",
        description: error instanceof Error ? error.message : "ذخیره ناموفق بود",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const onAddSlide = async (file: File) => {
    try {
      setUploading(true)
      const imageUrl = await uploadFile(file)
      const res = await fetch("/api/homepage/slides", {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({
          imageUrl,
          title: "",
          subtitle: "",
          sortOrder: slides.length,
          isActive: true,
        }),
      })
      if (!res.ok) throw new Error(await readError(res))
      toast({ title: "موفقیت", description: "اسلاید اضافه شد" })
      await loadAll()
    } catch (error) {
      toast({
        title: "خطا",
        description: error instanceof Error ? error.message : "آپلود اسلاید ناموفق بود",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const patchSlide = async (id: number, body: Partial<LandingSlide>) => {
    const res = await fetch(`/api/homepage/slides/${id}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(await readError(res))
  }

  const saveSlide = async (slide: LandingSlide) => {
    try {
      await patchSlide(slide.id, {
        title: slide.title || "",
        subtitle: slide.subtitle || "",
        sortOrder: Number(slide.sortOrder) || 0,
        isActive: Boolean(slide.isActive),
      })
      toast({ title: "موفقیت", description: "اسلاید به‌روزرسانی شد" })
      await loadAll()
    } catch (error) {
      toast({
        title: "خطا",
        description: error instanceof Error ? error.message : "ذخیره اسلاید ناموفق بود",
        variant: "destructive",
      })
    }
  }

  const deleteSlide = async (id: number) => {
    if (!confirm("این اسلاید حذف شود؟")) return
    try {
      const res = await fetch(`/api/homepage/slides/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error(await readError(res))
      toast({ title: "موفقیت", description: "اسلاید حذف شد" })
      await loadAll()
    } catch (error) {
      toast({
        title: "خطا",
        description: error instanceof Error ? error.message : "حذف اسلاید ناموفق بود",
        variant: "destructive",
      })
    }
  }

  const saveStaff = async (row: StaffRow) => {
    try {
      const res = await fetch(`/api/homepage/staff/${row.id}`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({
          showOnLanding: row.showOnLanding,
          avatarUrl: row.avatarUrl || null,
          displayTitle: row.displayTitle || null,
          bio: row.bio || null,
          landingSortOrder: Number(row.landingSortOrder) || 0,
        }),
      })
      if (!res.ok) throw new Error(await readError(res))
      toast({ title: "موفقیت", description: `${row.name} ذخیره شد` })
      await loadAll()
    } catch (error) {
      toast({
        title: "خطا",
        description: error instanceof Error ? error.message : "ذخیره آرایشگر ناموفق بود",
        variant: "destructive",
      })
    }
  }

  const uploadStaffPhoto = async (row: StaffRow, file: File) => {
    try {
      setUploading(true)
      const avatarUrl = await uploadFile(file)
      const next = { ...row, avatarUrl }
      setStaff((prev) => prev.map((s) => (s.id === row.id ? next : s)))
      await saveStaff(next)
    } catch (error) {
      toast({
        title: "خطا",
        description: error instanceof Error ? error.message : "آپلود پرتره ناموفق بود",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مدیریت صفحه اصلی</h1>
          <p className="text-muted-foreground">لندینگ لوکس مونوکروم دوکارد — هیرو، گالری و تیم</p>
        </div>
        <Button variant="outline" onClick={loadAll} disabled={loading}>
          <RefreshCw className="ml-2 h-4 w-4" />
          بازخوانی
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
          <TabsTrigger value="hero">Hero و اطلاعات عمومی</TabsTrigger>
          <TabsTrigger value="gallery">گالری و اسلایدر</TabsTrigger>
          <TabsTrigger value="team">تیم و آرایشگران</TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>هیرو</CardTitle>
              <CardDescription>عنوان و شعار بیلبورد روی صفحه اصلی</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="heroTitle">Hero Title</Label>
                <Input
                  id="heroTitle"
                  value={details.heroTitle || ""}
                  onChange={(e) => setDetails((d) => ({ ...d, heroTitle: e.target.value }))}
                  placeholder="DOOCARD BARBERSHOP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heroSubtitle">Hero Subtitle</Label>
                <Input
                  id="heroSubtitle"
                  value={details.heroSubtitle || ""}
                  onChange={(e) => setDetails((d) => ({ ...d, heroSubtitle: e.target.value }))}
                  placeholder="PRECISION IN EVERY DETAIL"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="about">داستان / درباره ما</Label>
                <Textarea
                  id="about"
                  rows={4}
                  value={details.about || ""}
                  onChange={(e) => setDetails((d) => ({ ...d, about: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact">متن تماس</Label>
                <Textarea
                  id="contact"
                  rows={3}
                  value={details.contact || ""}
                  onChange={(e) => setDetails((d) => ({ ...d, contact: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>اطلاعات سالن</CardTitle>
              <CardDescription>تلفن، اینستاگرام رسمی، آدرس و ساعات کاری</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">تلفن</Label>
                <Input
                  id="phone"
                  dir="ltr"
                  value={details.phone || ""}
                  onChange={(e) => setDetails((d) => ({ ...d, phone: e.target.value }))}
                  placeholder="021-26353460"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagramUrl">اینستاگرام</Label>
                <Input
                  id="instagramUrl"
                  dir="ltr"
                  value={details.instagramUrl || ""}
                  onChange={(e) => setDetails((d) => ({ ...d, instagramUrl: e.target.value }))}
                  placeholder="https://www.instagram.com/doocard"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">آدرس</Label>
                <Input
                  id="address"
                  value={details.address || ""}
                  onChange={(e) => setDetails((d) => ({ ...d, address: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weekdays">ساعات شنبه تا پنجشنبه</Label>
                <Input
                  id="weekdays"
                  value={hours.weekdays || ""}
                  onChange={(e) => setHours((h) => ({ ...h, weekdays: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="friday">ساعات جمعه</Label>
                <Input
                  id="friday"
                  value={hours.friday || ""}
                  onChange={(e) => setHours((h) => ({ ...h, friday: e.target.value }))}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="hoursNote">یادداشت ساعات کاری</Label>
                <Input
                  id="hoursNote"
                  value={hours.note || ""}
                  onChange={(e) => setHours((h) => ({ ...h, note: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={saveHero} disabled={saving}>
              <Save className="ml-2 h-4 w-4" />
              {saving ? "در حال ذخیره..." : "ذخیره Hero و اطلاعات"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="gallery" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>آپلود اسلاید</CardTitle>
              <CardDescription>JPEG / PNG / WebP تا ۵ مگابایت. پیش‌نمایش زنده پس از آپلود.</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-sm text-muted-foreground hover:bg-muted/40">
                <Upload className="mb-2 h-6 w-6" />
                {uploading ? "در حال آپلود..." : "انتخاب تصویر اسلاید"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void onAddSlide(file)
                    e.target.value = ""
                  }}
                />
              </label>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {slides.map((slide, index) => (
              <Card key={slide.id}>
                <CardContent className="grid gap-4 p-4 md:grid-cols-[220px_1fr]">
                  <div className="overflow-hidden rounded-lg border bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={slide.imageUrl} alt={slide.title || ""} className="h-40 w-full object-cover" />
                  </div>
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>عنوان</Label>
                        <Input
                          value={slide.title || ""}
                          onChange={(e) =>
                            setSlides((prev) =>
                              prev.map((s) => (s.id === slide.id ? { ...s, title: e.target.value } : s)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>زیرعنوان</Label>
                        <Input
                          value={slide.subtitle || ""}
                          onChange={(e) =>
                            setSlides((prev) =>
                              prev.map((s) => (s.id === slide.id ? { ...s, subtitle: e.target.value } : s)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>ترتیب</Label>
                        <Input
                          type="number"
                          value={slide.sortOrder ?? index}
                          onChange={(e) =>
                            setSlides((prev) =>
                              prev.map((s) =>
                                s.id === slide.id ? { ...s, sortOrder: Number(e.target.value) } : s,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3">
                        <Label htmlFor={`active-${slide.id}`}>فعال در لندینگ</Label>
                        <Switch
                          id={`active-${slide.id}`}
                          checked={Boolean(slide.isActive)}
                          onCheckedChange={(checked) =>
                            setSlides((prev) =>
                              prev.map((s) => (s.id === slide.id ? { ...s, isActive: checked } : s)),
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => void saveSlide(slide)}>
                        <Save className="ml-2 h-4 w-4" />
                        ذخیره اسلاید
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void deleteSlide(slide.id)}>
                        <Trash2 className="ml-2 h-4 w-4" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {slides.length === 0 && (
              <p className="text-sm text-muted-foreground">هنوز اسلایدی ثبت نشده است.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {staff.map((row) => (
            <Card key={row.id}>
              <CardHeader>
                <CardTitle className="text-lg">{row.name}</CardTitle>
                <CardDescription>{row.specialty || "آرایشگر فعال"}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="space-y-3">
                  <div className="aspect-[3/4] overflow-hidden rounded-lg border bg-muted">
                    {row.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.avatarUrl} alt={row.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        بدون پرتره
                      </div>
                    )}
                  </div>
                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <ImagePlus className="h-4 w-4" />
                    آپلود پرتره
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) void uploadStaffPhoto(row, file)
                        e.target.value = ""
                      }}
                    />
                  </label>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Label htmlFor={`show-${row.id}`}>نمایش در لندینگ</Label>
                    <Switch
                      id={`show-${row.id}`}
                      checked={row.showOnLanding}
                      onCheckedChange={(checked) =>
                        setStaff((prev) =>
                          prev.map((s) => (s.id === row.id ? { ...s, showOnLanding: checked } : s)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>عنوان نمایشی</Label>
                    <Input
                      value={row.displayTitle || ""}
                      placeholder="Master Barber"
                      onChange={(e) =>
                        setStaff((prev) =>
                          prev.map((s) => (s.id === row.id ? { ...s, displayTitle: e.target.value } : s)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>ترتیب</Label>
                    <Input
                      type="number"
                      value={row.landingSortOrder}
                      onChange={(e) =>
                        setStaff((prev) =>
                          prev.map((s) =>
                            s.id === row.id ? { ...s, landingSortOrder: Number(e.target.value) } : s,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>بیو</Label>
                    <Textarea
                      rows={4}
                      value={row.bio || ""}
                      onChange={(e) =>
                        setStaff((prev) =>
                          prev.map((s) => (s.id === row.id ? { ...s, bio: e.target.value } : s)),
                        )
                      }
                    />
                  </div>
                  <Button onClick={() => void saveStaff(row)}>
                    <Save className="ml-2 h-4 w-4" />
                    ذخیره این آرایشگر
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {staff.length === 0 && (
            <p className="text-sm text-muted-foreground">کارمند فعالی برای نمایش یافت نشد.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
