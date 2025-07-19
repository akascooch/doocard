"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import axios from "@/lib/axios"

interface Staff {
  id: number
  firstName: string
  lastName: string
  email: string
  phoneNumber: string
  bio?: string
  avatar?: string
  services: Service[]
  isActive: boolean
}

interface Service {
  id: number
  name: string
  duration: number
  price: number
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    bio: "",
    serviceIds: [] as number[],
  })

  useEffect(() => {
    fetchStaff()
    fetchServices()
  }, [])

  const fetchStaff = async () => {
    try {
      const response = await axios.get("/barbers")
      setStaff(response.data)
    } catch (error) {
      toast({
        title: "خطا در دریافت اطلاعات",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchServices = async () => {
    try {
      const response = await axios.get("/services")
      console.log("Services loaded:", response.data)
      setServices(response.data)
    } catch (error) {
      console.error("Error fetching services:", error)
      toast({
        title: "خطا در دریافت خدمات",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (selectedStaff) {
        await axios.patch(`/barbers/${selectedStaff.id}`, formData)
        toast({
          title: "ویرایش موفق",
          description: "اطلاعات کارمند با موفقیت به‌روزرسانی شد",
        })
      } else {
        await axios.post("/barbers", formData)
        toast({
          title: "ثبت موفق",
          description: "کارمند جدید با موفقیت اضافه شد",
        })
      }

      setIsDialogOpen(false)
      fetchStaff()
      resetForm()
    } catch (error: any) {
      toast({
        title: "خطا",
        description: error.response?.data?.message || "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = (member: Staff) => {
    setSelectedStaff(member)
    setFormData({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phoneNumber: member.phoneNumber,
      bio: member.bio || "",
      serviceIds: member.services.map(s => s.id),
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف این کارمند اطمینان دارید؟")) return

    try {
      await axios.delete(`/barbers/${id}`)
      toast({
        title: "حذف موفق",
        description: "کارمند با موفقیت حذف شد",
      })
      fetchStaff()
    } catch (error) {
      toast({
        title: "خطا در حذف",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      phoneNumber: "",
      bio: "",
      serviceIds: [],
    })
    setSelectedStaff(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">مدیریت کارکنان</h1>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm()
            }}>
              <Icon name="UserPlus" className="ml-2" size={16} />
              افزودن کارمند جدید
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedStaff ? "ویرایش کارمند" : "افزودن کارمند جدید"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6 p-2 md:p-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>نام</Label>
                  <Input
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>نام خانوادگی</Label>
                  <Input
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>ایمیل</Label>
                  <Input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>شماره موبایل</Label>
                  <Input
                    required
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, phoneNumber: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>بیوگرافی (اختیاری)</Label>
                  <Input
                    value={formData.bio}
                    onChange={(e) =>
                      setFormData({ ...formData, bio: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>خدمات قابل انجام</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                    {services.map((service) => (
                      <label key={service.id} className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition ${formData.serviceIds.includes(service.id) ? 'bg-primary/10 border-primary' : 'bg-muted/50 border-border'}`}>
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={formData.serviceIds.includes(service.id)}
                          onChange={e => {
                            let newSelected: number[]
                            if (e.target.checked) {
                              newSelected = [...formData.serviceIds, service.id]
                            } else {
                              newSelected = formData.serviceIds.filter(id => id !== service.id)
                            }
                            setFormData({ ...formData, serviceIds: newSelected })
                          }}
                        />
                        <span>{service.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit">
                  {selectedStaff ? "ویرایش" : "افزودن"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Icon name="Loader" className="animate-spin" size={24} />
        </div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Icon name="Users" size={48} className="mb-4" />
          <p>هیچ کارمندی ثبت نشده است</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {staff.map((member) => (
            <div
              key={member.id}
              className="relative rounded-lg border bg-card p-4 transition-all hover:shadow-md"
            >
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                  {member.firstName[0]}
                  {member.lastName[0]}
                </div>
                <div>
                  <h3 className="font-medium">
                    {member.firstName} {member.lastName}
                  </h3>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                  <p className="text-sm text-muted-foreground">
                    {member.phoneNumber}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">خدمات قابل ارائه:</h4>
                <div className="flex flex-wrap gap-2">
                  {member.services.map((service) => (
                    <span
                      key={service.id}
                      className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {service.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="absolute left-2 top-2 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleEdit(member)}
                >
                  <Icon name="Edit" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(member.id)}
                >
                  <Icon name="Trash2" size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 