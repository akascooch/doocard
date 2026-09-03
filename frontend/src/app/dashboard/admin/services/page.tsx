"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Scissors, 
  Plus,
  Edit,
  Trash2,
  Clock,
  DollarSign,
  Search,
  Users
} from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { getDashboardHomePath } from '@/lib/user-roles'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/axios'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import MoneyInput from '@/components/ui/MoneyInput'
import { toThousandTomans } from '@/lib/money'
import { type EmployeeListItem, normalizeEmployeeList } from '@/lib/employee'

interface Service {
  id: number
  name: string
  description?: string
  durationMinutes: number
  price: number
  createdAt: string
  updatedAt: string
}

export default function AdminServices() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationMinutes: 60,
    price: 0
  })
  
  // Employee assignment states
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([])

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      // Check if user is admin
      if (currentUser.role !== 'ADMIN') {
        window.location.href = getDashboardHomePath(currentUser.role)
        return
      }
    }
    
    // Fetch services and employees
    fetchServices()
    fetchEmployees()
  }, [])

  const fetchServices = async () => {
    try {
      const response = await api.get('/services')
      setServices(response.data)
    } catch (error) {
      console.error('Error fetching services:', error)
      // Fallback to mock data
      setServices([
        {
          id: 1,
          name: 'آرایش صورت',
          description: 'آرایش',
          durationMinutes: 90,
          price: 500000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          name: 'کاشت ناخن',
          description: 'ناخن',
          durationMinutes: 120,
          price: 800000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: 3,
          name: 'مراقبت پوست',
          description: 'پوست',
          durationMinutes: 60,
          price: 300000,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees')
      setEmployees(normalizeEmployeeList(response.data))
    } catch (error) {
      console.error('Error fetching employees:', error)
      setEmployees([])
    }
  }

  const handleOpenEmployeeDialog = async (service: Service) => {
    setSelectedService(service)
    setIsEmployeeDialogOpen(true)
    
    // Fetch current employees assigned to this service
    try {
      const response = await api.get(`/employees/by-service/${service.id}`)
      setSelectedEmployeeIds(response.data.map((emp: any) => emp.id))
    } catch (error) {
      console.error('Error fetching service employees:', error)
      setSelectedEmployeeIds([])
    }
  }

  const handleAssignEmployees = async () => {
    if (!selectedService) return

    try {
      // For each selected employee, get their existing services and add the new one
      for (const employeeId of selectedEmployeeIds) {
        try {
          // Get current services for this employee
          const { data: currentServices } = await api.get(`/employees/${employeeId}/services`)
          
          // Extract service IDs and add the new service (avoid duplicates)
          const currentServiceIds = currentServices.map((s: any) => s.serviceId)
          const updatedServiceIds = Array.from(new Set([...currentServiceIds, selectedService.id]))
          
          // Update employee services
          await api.post(`/employees/${employeeId}/services`, {
            serviceIds: updatedServiceIds
          })
        } catch (err) {
          console.error(`Error assigning service to employee ${employeeId}:`, err)
          throw err
        }
      }

      // Also handle unselected employees - remove the service from them
      const unselectedEmployeeIds = employees
        .filter(emp => !selectedEmployeeIds.includes(emp.id))
        .map(emp => emp.id)
      
      for (const employeeId of unselectedEmployeeIds) {
        try {
          // Get current services for this employee
          const { data: currentServices } = await api.get(`/employees/${employeeId}/services`)
          
          // Check if they have this service
          if (currentServices.some((s: any) => s.serviceId === selectedService.id)) {
            // Remove this service but keep others
            const updatedServiceIds = currentServices
              .map((s: any) => s.serviceId)
              .filter((id: number) => id !== selectedService.id)
            
            if (updatedServiceIds.length > 0) {
              await api.post(`/employees/${employeeId}/services`, {
                serviceIds: updatedServiceIds
              })
            } else {
              // If no services left, send empty array
              await api.post(`/employees/${employeeId}/services`, {
                serviceIds: []
              })
            }
          }
        } catch (err) {
          console.error(`Error removing service from employee ${employeeId}:`, err)
          // Don't throw here, just log
        }
      }
      
      toast({
        title: 'موفق',
        description: 'خدمت با موفقیت به کارمندان اختصاص داده شد'
      })
      
      setIsEmployeeDialogOpen(false)
    } catch (error) {
      console.error('Error assigning employees:', error)
      toast({
        title: 'خطا',
        description: 'خطا در اختصاص خدمت به کارمندان',
        variant: 'destructive'
      })
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours} ساعت ${mins} دقیقه`
    }
    return `${mins} دقیقه`
  }

  const handleAddService = async () => {
    try {
      await api.post('/services', formData)

      toast({
        title: 'موفق',
        description: 'خدمت با موفقیت اضافه شد'
      })

      setFormData({ name: '', description: '', durationMinutes: 60, price: 0 })
      setShowAddForm(false)
      fetchServices()
    } catch (error) {
      console.error('Error adding service:', error)
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در اضافه کردن خدمت'
      })
    }
  }

  const handleEditService = async () => {
    if (!editingService) return

    try {
      await api.put(`/services/${editingService.id}`, formData)

      toast({
        title: 'موفق',
        description: 'خدمت با موفقیت به‌روزرسانی شد'
      })

      setFormData({ name: '', description: '', durationMinutes: 60, price: 0 })
      setEditingService(null)
      fetchServices()
    } catch (error) {
      console.error('Error updating service:', error)
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در به‌روزرسانی خدمت'
      })
    }
  }

  const handleDeleteService = async (serviceId: number) => {
    if (!confirm('آیا مطمئن هستید که می‌خواهید این خدمت را حذف کنید؟')) {
      return
    }

    try {
      await api.delete(`/services/${serviceId}`)

      toast({
        title: 'موفق',
        description: 'خدمت با موفقیت حذف شد'
      })

      fetchServices()
    } catch (error) {
      console.error('Error deleting service:', error)
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در حذف خدمت'
      })
    }
  }

  const startEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      name: service.name,
      description: service.description || '',
      durationMinutes: service.durationMinutes,
      price: service.price
    })
    setShowAddForm(true)
  }

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (service.description && service.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main-orange"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            مدیریت خدمات
          </h1>
          <p className="text-muted-foreground mt-2">
            مدیریت خدمات و قیمت‌های سالن
          </p>
        </div>
        <Button 
          className="doocard-gradient hover:opacity-90"
          onClick={() => {
            setShowAddForm(true)
            setEditingService(null)
            setFormData({ name: '', description: '', durationMinutes: 60, price: 0 })
          }}
        >
          <Plus className="ml-2 h-4 w-4" />
          خدمت جدید
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="جستجو در خدمات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingService ? 'ویرایش خدمت' : 'افزودن خدمت جدید'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">نام خدمت *</Label>
                <Input
                  id="name"
                  placeholder="نام خدمت"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">توضیحات</Label>
                <Input
                  id="description"
                  placeholder="توضیحات خدمت (اختیاری)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">مدت زمان (دقیقه) *</Label>
                <Input
                  id="duration"
                  type="number"
                  placeholder="مدت زمان"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <MoneyInput
                  value={formData.price}
                  onChange={(rials) => setFormData({ ...formData, price: rials })}
                  label="قیمت *"
                  placeholder="مثال: 125,000"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={editingService ? handleEditService : handleAddService}
                className="doocard-gradient hover:opacity-90"
              >
                {editingService ? 'به‌روزرسانی' : 'افزودن'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingService(null)
                  setFormData({ name: '', description: '', durationMinutes: 60, price: 0 })
                }}
              >
                لغو
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map((service) => (
          <Card key={service.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="h-5 w-5 text-main-orange" />
                  {service.name}
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEmployeeDialog(service)}
                    className="text-blue-600 hover:text-blue-700"
                    title="اختصاص به کارمندان"
                  >
                    <Users className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(service)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteService(service.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {service.description && (
                <Badge variant="secondary" className="w-fit">
                  {service.description}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>مدت زمان: {formatDuration(service.durationMinutes)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>قیمت: {toThousandTomans(service.price)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Scissors className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">خدمتی یافت نشد</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? 'با عبارت جستجو شده خدمتی یافت نشد'
                : 'هنوز خدمتی ثبت نشده است'
              }
            </p>
            <Button 
              className="doocard-gradient hover:opacity-90"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="ml-2 h-4 w-4" />
              افزودن خدمت جدید
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Employee Assignment Dialog */}
      <Dialog open={isEmployeeDialogOpen} onOpenChange={setIsEmployeeDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>اختصاص خدمت به کارمندان</DialogTitle>
            <DialogDescription>
              کارمندانی که می‌توانند خدمت "{selectedService?.name}" را ارائه دهند را انتخاب کنید
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-3">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    id={`employee-${employee.id}`}
                    checked={selectedEmployeeIds.includes(employee.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmployeeIds([...selectedEmployeeIds, employee.id])
                      } else {
                        setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== employee.id))
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor={`employee-${employee.id}`} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-medium text-foreground">{employee.name}</span>
                      {employee.specialty && (
                        <span className="text-sm text-muted-foreground">{employee.specialty}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{employee.phone}</span>
                  </label>
                </div>
              ))}
            </div>
            
            {employees.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                هیچ کارمندی یافت نشد
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsEmployeeDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleAssignEmployees} className="bg-main-orange hover:bg-main-orange/90">
              ذخیره تغییرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}