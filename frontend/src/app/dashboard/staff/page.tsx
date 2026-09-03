"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/ui/use-toast"
import axios from "@/lib/axios"
import { useRouter } from "next/navigation"
import { DollarSign } from "lucide-react"
import {
  type EmployeeListItem,
  getEmployeeDisplayName,
  normalizeEmployeeList,
} from "@/lib/employee"
import { toThousandTomans } from "@/lib/money"

interface Service {
  id: number
  name: string
  durationMinutes?: number
  price: number
}

export default function StaffPage() {
  const [staff, setStaff] = useState<EmployeeListItem[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<EmployeeListItem | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    specialty: "",
    baseSalary: 0,
    commissionRate: 0,
    serviceIds: [] as number[],
  })

  useEffect(() => {
    fetchStaff()
    fetchServices()
  }, [])

  const fetchStaff = async () => {
    try {
      const response = await axios.get("/employees")
      setStaff(normalizeEmployeeList(response.data))
    } catch (error) {
      console.error("Error fetching staff:", error)
      setStaff([])
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

    if (!formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: "خطا",
        description: "نام و شماره موبایل الزامی است",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      if (selectedStaff) {
        await axios.patch(`/employees/${selectedStaff.id}`, {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          specialty: formData.specialty.trim() || undefined,
          baseSalary: formData.baseSalary,
          commissionRate: formData.commissionRate,
        })
        if (formData.serviceIds.length >= 0) {
          await axios.post(`/employees/${selectedStaff.id}/services`, {
            serviceIds: formData.serviceIds,
          })
        }
        toast({
          title: "ویرایش موفق",
          description: "اطلاعات کارمند با موفقیت به‌روزرسانی شد",
        })
      } else {
        const { data: created } = await axios.post("/employees", {
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim() || undefined,
          specialty: formData.specialty.trim() || undefined,
          baseSalary: formData.baseSalary,
          commissionRate: formData.commissionRate,
        })
        if (formData.serviceIds.length > 0 && created?.id) {
          await axios.post(`/employees/${created.id}/services`, {
            serviceIds: formData.serviceIds,
          })
        }
        toast({
          title: "ثبت موفق",
          description: "کارمند جدید با موفقیت اضافه شد",
        })
      }

      setIsDialogOpen(false)
      await fetchStaff()
      resetForm()
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast({
        title: "خطا",
        description: err.response?.data?.message || "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = async (member: EmployeeListItem) => {
    setSelectedStaff(member)
    let serviceIds: number[] = member.services?.map((s) => s.id) ?? []
    try {
      const { data } = await axios.get(`/employees/${member.id}/services`)
      if (Array.isArray(data)) {
        serviceIds = data.map((row: { serviceId: number }) => row.serviceId)
      }
    } catch {
      // keep services from list payload
    }
    setFormData({
      name: member.name,
      phone: member.phone,
      email: member.email ?? "",
      specialty: member.specialty ?? "",
      baseSalary: member.baseSalary ?? 0,
      commissionRate: member.commissionRate ?? 0,
      serviceIds,
    })
    setIsDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("آیا از حذف این کارمند اطمینان دارید؟")) return

    try {
      await axios.delete(`/employees/${id}`)
      toast({
        title: "حذف موفق",
        description: "کارمند با موفقیت حذف شد",
      })
      fetchStaff()
    } catch {
      toast({
        title: "خطا در حذف",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      phone: "",
      email: "",
      specialty: "",
      baseSalary: 0,
      commissionRate: 0,
      serviceIds: [],
    })
    setSelectedStaff(null)
  }

  const initials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return "?"
    if (parts.length === 1) return parts[0].slice(0, 2)
    return `${parts[0][0]}${parts[parts.length - 1][0]}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">کارکنان</h2>
          <p className="text-muted-foreground">مدیریت کارکنان و خدمات قابل ارائه</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/admin/employees")}
          >
            مدیریت پیشرفته
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/accounting?tab=salary-management")}
          >
            <DollarSign className="h-4 w-4 ml-2" />
            مدیریت حقوق
          </Button>
          <Button onClick={() => { resetForm(); setIsDialogOpen(true) }}>افزودن کارمند</Button>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStaff ? "ویرایش کارمند" : "افزودن کارمند جدید"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 p-2 md:p-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>نام و نام خانوادگی</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>شماره موبایل</Label>
                <Input
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>ایمیل (اختیاری)</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>تخصص (اختیاری)</Label>
                <Input
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>خدمات قابل انجام</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                  {services.map((service) => (
                    <label
                      key={service.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition ${formData.serviceIds.includes(service.id) ? "bg-primary/10 border-primary" : "bg-muted/50 border-border"}`}
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={formData.serviceIds.includes(service.id)}
                        onChange={(e) => {
                          const newSelected = e.target.checked
                            ? [...formData.serviceIds, service.id]
                            : formData.serviceIds.filter((id) => id !== service.id)
                          setFormData({ ...formData, serviceIds: newSelected })
                        }}
                      />
                      <span>{service.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <Button type="submit" disabled={isLoading}>
              {selectedStaff ? "ویرایش" : "افزودن"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

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
          {staff.map((member) => {
            const displayName = getEmployeeDisplayName(member)
            const memberServices = member.services ?? []
            return (
              <div
                key={member.id}
                className="relative rounded-lg border bg-card p-4 transition-all hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                    {initials(displayName)}
                  </div>
                  <div>
                    <h3 className="font-medium">{displayName}</h3>
                    <p className="text-sm text-muted-foreground">{member.phone}</p>
                    {member.specialty && (
                      <p className="text-sm text-muted-foreground">{member.specialty}</p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">خدمات قابل ارائه:</h4>
                  <div className="flex flex-wrap gap-2">
                    {memberServices.length === 0 ? (
                      <span className="text-xs text-muted-foreground">خدماتی ثبت نشده</span>
                    ) : (
                      memberServices.map((service) => (
                        <span
                          key={service.id}
                          className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {service.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="absolute left-2 top-2 flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(member)}>
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
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                      (member.status ?? "active") === "active"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {(member.status ?? "active") === "active" ? "فعال" : "غیرفعال"}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700">
                    کمیسیون {member.commissionRate}% · پایه {toThousandTomans(member.baseSalary)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
