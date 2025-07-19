"use client"

import { useState, useEffect } from "react"
import api from "@/lib/axios"
import { PlusIcon, PencilIcon, TrashIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

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
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration: "",
    price: "",
  })

  const fetchServices = async () => {
    try {
      const response = await api.get("/services")
      setServices(response.data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "دریافت لیست خدمات با مشکل مواجه شد",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServices()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const serviceData = {
      ...formData,
      duration: parseInt(formData.duration),
      price: parseFloat(formData.price.replace(/,/g, "")),
    }

    try {
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
      setFormData({ name: "", description: "", duration: "", price: "" })
      setEditingService(null)
      fetchServices()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "خطا",
        description: "عملیات با مشکل مواجه شد",
      })
    }
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description,
      duration: service.duration.toString(),
      price: service.price.toString(),
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف این خدمت اطمینان دارید؟")) return

    try {
      await api.delete(`/services/${id}`)
      toast({
        title: "موفق",
        description: "خدمت با موفقیت حذف شد",
      })
      fetchServices()
    } catch (error: any) {
      let description = "حذف خدمت با مشکل مواجه شد";
      let title = "خطا";
      let variant: "default" | "destructive" = "destructive";
      // اگر پیام سرور وجود داشت
      if (error.response && error.response.data && error.response.data.message) {
        description = error.response.data.message;
        // اگر خطای 409 بود (conflict)
        if (error.response.status === 409) {
          title = "امکان حذف وجود ندارد";
          variant = "destructive";
        }
      } else if (error.message === "Network Error") {
        description = "ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت را بررسی کنید.";
      }
      toast({
        variant,
        title,
        description,
      });
    }
  }

  if (loading) {
    return <div>در حال بارگذاری...</div>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>مدیریت خدمات</CardTitle>
            <CardDescription>لیست خدمات قابل ارائه در آرایشگاه</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              setEditingService(null)
              setFormData({ name: "", description: "", duration: "", price: "" })
            }
          }}>
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
                    <Label htmlFor="name">نام خدمت</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">توضیحات</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">مدت زمان (دقیقه)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="1"
                      value={formData.duration}
                      onChange={(e) =>
                        setFormData({ ...formData, duration: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">قیمت (تومان)</Label>
                    <Input
                      id="price"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9,]*"
                      value={formData.price ? formData.price.replace(/\B(?=(\d{3})+(?!\d))/g, ",") : ""}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/[^\d]/g, "");
                        setFormData({ ...formData, price: raw });
                      }}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">
                    {editingService ? "ویرایش" : "افزودن"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>نام خدمت</TableHead>
              <TableHead>توضیحات</TableHead>
              <TableHead>مدت (دقیقه)</TableHead>
              <TableHead>قیمت (تومان)</TableHead>
              <TableHead>عملیات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.map((service) => (
              <TableRow key={service.id}>
                <TableCell>{service.name}</TableCell>
                <TableCell>{service.description}</TableCell>
                <TableCell>{service.duration}</TableCell>
                <TableCell>
                  {service.price.toLocaleString("fa-IR")}
                </TableCell>
                <TableCell className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(service)}
                  >
                    <PencilIcon className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(service.id)}
                  >
                    <TrashIcon className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
} 