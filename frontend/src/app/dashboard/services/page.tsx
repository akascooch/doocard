"use client"

import { useState, useEffect } from "react"
import api from "../../../lib/axios"
import { PlusIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline"
import { Button } from "../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../../components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { useToast } from "../../../components/ui/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table"
import { Skeleton } from "../../../components/ui/skeleton"
import { Badge } from "../../../components/ui/badge"

interface Service {
  id: number
  name: string
  description: string
  duration: number
  price: number
  isActive: boolean
}

export default function ServicesPage() {
  const { toast } = useToast()
  const [services, setServices] = useState<Service[]>([])
  const [filteredServices, setFilteredServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration: "",
    price: "",
  })

  const fetchServices = async () => {
    try {
      setLoading(true)
      const response = await api.get("/services")
      setServices(response.data)
      setFilteredServices(response.data)
    } catch (error: any) {
      console.error('Error fetching services:', error)
      toast({
        variant: "destructive",
        title: "خطا در دریافت خدمات",
        description: error.response?.data?.message || "دریافت لیست خدمات با مشکل مواجه شد",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServices()
  }, [])

  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredServices(services)
    } else {
      const filtered = services.filter(service =>
        service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        service.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredServices(filtered)
    }
  }, [searchTerm, services])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name.trim()) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "نام خدمت الزامی است",
      })
      return
    }

    if (!formData.duration || parseInt(formData.duration) <= 0) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "مدت زمان باید بیشتر از صفر باشد",
      })
      return
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "قیمت باید بیشتر از صفر باشد",
      })
      return
    }
    
    const serviceData = {
      ...formData,
      duration: parseInt(formData.duration),
      price: parseFloat(formData.price.replace(/,/g, "")),
    }

    try {
      setSubmitting(true)
      if (editingService) {
        await api.patch(
          `/services/${editingService.id}`,
          serviceData
        )
        toast({
          title: "موفق",
          description: "خدمت با موفقیت ویرایش شد",
        })
      } else {
        await api.post("/services", serviceData)
        toast({
          title: "موفق",
          description: "خدمت جدید با موفقیت ایجاد شد",
        })
      }
      
      setIsDialogOpen(false)
      setEditingService(null)
      setFormData({ name: "", description: "", duration: "", price: "" })
      fetchServices()
    } catch (error: any) {
      console.error('Error saving service:', error)
      toast({
        variant: "destructive",
        title: "خطا در ذخیره خدمت",
        description: error.response?.data?.message || "خطا در ذخیره خدمت",
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || "",
      duration: service.duration.toString(),
      price: service.price.toString(),
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    try {
      setDeleting(id)
      await api.delete(`/services/${id}`)
      toast({
        title: "موفق",
        description: "خدمت با موفقیت حذف شد",
      })
      fetchServices()
    } catch (error: any) {
      console.error('Error deleting service:', error)
      toast({
        variant: "destructive",
        title: "خطا در حذف خدمت",
        description: error.response?.data?.message || "خطا در حذف خدمت",
      })
    } finally {
      setDeleting(null)
    }
  }

  const resetForm = () => {
    setFormData({ name: "", description: "", duration: "", price: "" })
    setEditingService(null)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      resetForm()
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>مدیریت خدمات</CardTitle>
                <CardDescription>در حال بارگذاری...</CardDescription>
              </div>
              <Skeleton className="h-10 w-24" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="grid grid-cols-4 gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (services.length === 0 && !loading) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>مدیریت خدمات</CardTitle>
                <CardDescription>افزودن، ویرایش و حذف خدمات آرایشگاه</CardDescription>
              </div>
              <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <PlusIcon className="h-4 w-4 ml-2" />
                    افزودن خدمت
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>افزودن خدمت جدید</DialogTitle>
                    <DialogDescription>
                      اطلاعات خدمت را وارد کنید
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-6 p-2 md:p-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">نام خدمت *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e: any) =>
                            setFormData({ ...formData, name: e.target.value })
                          }
                          required
                          placeholder="مثال: کوتاهی مو"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">توضیحات</Label>
                        <Input
                          id="description"
                          value={formData.description}
                          onChange={(e: any) =>
                            setFormData({ ...formData, description: e.target.value })
                          }
                          placeholder="توضیحات اختیاری"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">مدت زمان (دقیقه) *</Label>
                        <Input
                          id="duration"
                          type="number"
                          min="1"
                          value={formData.duration}
                          onChange={(e: any) =>
                            setFormData({ ...formData, duration: e.target.value })
                          }
                          required
                          placeholder="30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price">قیمت (تومان) *</Label>
                        <Input
                          id="price"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9,]*"
                          value={formData.price ? formData.price.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""}
                          onChange={(e: any) => {
                            let raw = e.target.value.replace(/[^\d]/g, "");
                            setFormData({ ...formData, price: raw });
                          }}
                          required
                          placeholder="50000"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            در حال ذخیره...
                          </div>
                        ) : (
                          "افزودن"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">✂️</div>
              <h3 className="text-lg font-semibold mb-2">هیچ خدمتی یافت نشد</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                برای شروع، اولین خدمت را اضافه کنید
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <PlusIcon className="h-4 w-4 ml-2" />
                افزودن خدمت
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>مدیریت خدمات</CardTitle>
              <CardDescription>افزودن، ویرایش و حذف خدمات آرایشگاه</CardDescription>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingService(null)
                  setFormData({ name: "", description: "", duration: "", price: "" })
                }}>
                  <PlusIcon className="ml-2 h-4 w-4" />
                  افزودن خدمت
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingService ? "ویرایش خدمت" : "افزودن خدمت جدید"}</DialogTitle>
                  <DialogDescription>
                    اطلاعات خدمت را وارد کنید
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 p-2 md:p-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">نام خدمت *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e: any) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        placeholder="مثال: کوتاهی مو"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">توضیحات</Label>
                      <Input
                        id="description"
                        value={formData.description}
                        onChange={(e: any) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        placeholder="توضیحات اختیاری"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">مدت زمان (دقیقه) *</Label>
                      <Input
                        id="duration"
                        type="number"
                        min="1"
                        value={formData.duration}
                        onChange={(e: any) =>
                          setFormData({ ...formData, duration: e.target.value })
                        }
                        required
                        placeholder="30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">قیمت (تومان) *</Label>
                      <Input
                        id="price"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9,]*"
                        value={formData.price ? formData.price.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""}
                        onChange={(e: any) => {
                          let raw = e.target.value.replace(/[^\d]/g, "");
                          setFormData({ ...formData, price: raw });
                        }}
                        required
                        placeholder="50000"
                      />
                    </div>
                  </div>
                                      <DialogFooter>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            در حال ذخیره...
                          </div>
                        ) : (
                          editingService ? "ویرایش" : "افزودن"
                        )}
                      </Button>
                    </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Input
                placeholder="جستجو در خدمات..."
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            {searchTerm && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {filteredServices.length} خدمت از {services.length} خدمت یافت شد
              </div>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>نام خدمت</TableHead>
                <TableHead>توضیحات</TableHead>
                <TableHead>مدت (دقیقه)</TableHead>
                <TableHead>قیمت (تومان)</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-gray-500 dark:text-gray-400">
                      <div className="text-4xl mb-2">
                        {searchTerm ? "🔍" : "✂️"}
                      </div>
                      <div className="font-medium">
                        {searchTerm ? "هیچ خدمتی یافت نشد" : "هیچ خدمتی یافت نشد"}
                      </div>
                      <div className="text-sm">
                        {searchTerm 
                          ? `هیچ خدمتی با عبارت "${searchTerm}" یافت نشد`
                          : "برای شروع، اولین خدمت را اضافه کنید"
                        }
                      </div>
                      {searchTerm && (
                        <Button 
                          variant="outline" 
                          className="mt-2"
                          onClick={() => setSearchTerm("")}
                        >
                          پاک کردن جستجو
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredServices.map((service) => (
                  <TableRow key={service.id}>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{service.description || "-"}</TableCell>
                    <TableCell>{service.duration}</TableCell>
                    <TableCell>
                      {service.price.toLocaleString("fa-IR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={service.isActive ? "default" : "secondary"}>
                        {service.isActive ? "فعال" : "غیرفعال"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(service)}
                        title="ویرایش"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="حذف"
                            disabled={deleting === service.id}
                          >
                            {deleting === service.id ? (
                              <Skeleton className="h-4 w-4" />
                            ) : (
                              <TrashIcon className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <ExclamationTriangleIcon className="h-5 w-5 text-destructive" />
                              حذف خدمت
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              آیا از حذف خدمت "{service.name}" اطمینان دارید؟ این عملیات قابل بازگشت نیست.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>انصراف</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(service.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              حذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
} 