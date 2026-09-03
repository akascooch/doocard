"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  UserCog, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Calendar,
  DollarSign,
  Star,
  TrendingUp,
  Eye,
  Settings
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import axios from '@/lib/axios'
import { EmployeeServicesDisplay } from '@/components/employee-services-display'
import { toThousandTomans } from '@/lib/money'
import {
  type EmployeeListItem,
  getEmployeeDisplayName,
  normalizeEmployeeList,
} from '@/lib/employee'

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeListItem | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isServicesDialogOpen, setIsServicesDialogOpen] = useState(false)
  const [availableServices, setAvailableServices] = useState<any[]>([])
  const [employeeServices, setEmployeeServices] = useState<any[]>([])
  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([])
  const { toast } = useToast()

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    specialty: '',
    baseSalary: 0,
    commissionRate: 0,
    password: ''
  })

  useEffect(() => {
    fetchEmployees()
    fetchServices()
  }, [])

  const fetchEmployees = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/employees')
      const list = normalizeEmployeeList(response.data)
      setEmployees(list)
      if (Array.isArray(response.data) && list.length < response.data.length) {
        console.warn(
          `[employees] ${response.data.length - list.length} row(s) skipped (missing user/name)`,
        )
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
      setEmployees([])
      toast({
        title: 'خطا',
        description: 'خطا در دریافت اطلاعات کارمندان',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchServices = async () => {
    try {
      const response = await axios.get('/services')
      setAvailableServices(response.data)
    } catch (error) {
      console.error('Error fetching services:', error)
      toast({
        title: 'خطا',
        description: 'خطا در دریافت لیست خدمات',
        variant: 'destructive'
      })
    }
  }

  const fetchEmployeeServices = async (employeeId: number) => {
    try {
      const response = await axios.get(`/employees/${employeeId}/services`)
      setEmployeeServices(response.data)
      setSelectedServiceIds(response.data.map((es: any) => es.serviceId))
    } catch (error) {
      console.error('Error fetching employee services:', error)
      setEmployeeServices([])
      setSelectedServiceIds([])
    }
  }

  const handleOpenServicesDialog = async (employee: EmployeeListItem) => {
    setSelectedEmployee(employee)
    setIsServicesDialogOpen(true)
    await fetchEmployeeServices(employee.id)
  }

  const handleAssignServices = async () => {
    if (!selectedEmployee) return

    try {
      await axios.post(`/employees/${selectedEmployee.id}/services`, {
        serviceIds: selectedServiceIds
      })
      
      toast({
        title: 'موفق',
        description: 'خدمات با موفقیت به کارمند اختصاص داده شد',
        variant: 'default'
      })
      
      setIsServicesDialogOpen(false)
      await fetchEmployeeServices(selectedEmployee.id)
    } catch (error) {
      console.error('Error assigning services:', error)
      toast({
        title: 'خطا',
        description: 'خطا در اختصاص خدمات به کارمند',
        variant: 'destructive'
      })
    }
  }

  const handleEditEmployee = async () => {
    if (!selectedEmployee) return
    
    try {
      // Update user info only
      await axios.patch(`/users/${selectedEmployee?.user?.id}`, {
        name: formData.name,
        phone: formData.phone,
        email: formData.email
      })
      
      toast({
        title: 'موفق',
        description: 'اطلاعات کارمند با موفقیت به‌روزرسانی شد'
      })
      setIsEditDialogOpen(false)
      resetForm()
      fetchEmployees()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در به‌روزرسانی کارمند',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteEmployee = async (employeeId: number) => {
    if (!confirm('آیا از حذف این کارمند اطمینان دارید؟')) return
    
    try {
      await axios.delete(`/employees/${employeeId}`)
      toast({
        title: 'موفق',
        description: 'کارمند با موفقیت حذف شد'
      })
      fetchEmployees()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در حذف کارمند',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      specialty: '',
      baseSalary: 0,
      commissionRate: 0,
      password: ''
    })
    setSelectedEmployee(null)
  }

  const openEditDialog = (employee: EmployeeListItem) => {
    setSelectedEmployee(employee)
    setFormData({
      name: employee.name,
      phone: employee.phone,
      email: employee.email || employee.user?.email || '',
      specialty: '', // Not used in edit form
      baseSalary: 0, // Not used in edit form
      commissionRate: 0, // Not used in edit form
      password: ''
    })
    setIsEditDialogOpen(true)
  }

  const filteredEmployees = employees.filter((employee) => {
    const displayName = getEmployeeDisplayName(employee).toLowerCase()
    const phone = employee.phone || employee.user?.phone || ''
    const email = (employee.email ?? employee.user?.email ?? '').toLowerCase()
    const matchesSearch =
      displayName.includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm) ||
      email.includes(searchTerm.toLowerCase()) ||
      (employee.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)

    const matchesFilter =
      filterStatus === 'all' || (employee.status ?? 'active') === filterStatus

    return matchesSearch && matchesFilter
  })

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
            مدیریت کارکنان
          </h1>
          <p className="text-muted-foreground mt-2">
            مدیریت کارکنان و تنظیمات حقوق و دستمزد
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل کارکنان</CardTitle>
            <UserCog className="h-4 w-4 text-main-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کارکنان فعال</CardTitle>
            <UserCog className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.filter((e) => (e.status ?? 'active') === 'active').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">میانگین امتیاز</CardTitle>
            <Star className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              0
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل درآمد ماهانه</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {toThousandTomans(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>جستجو و فیلتر</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="جستجو بر اساس نام، شماره موبایل، ایمیل یا تخصص..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select defaultValue={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="فیلتر بر اساس وضعیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه کارکنان</SelectItem>
                  <SelectItem value="active">فعال</SelectItem>
                  <SelectItem value="inactive">غیرفعال</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle>لیست کارکنان</CardTitle>
          <CardDescription>
            {filteredEmployees.length} کارمند از {employees.length} کارمند
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>تخصص</TableHead>
                  <TableHead>شماره موبایل</TableHead>
                  <TableHead>ایمیل</TableHead>
                  <TableHead>خدمات</TableHead>
                  <TableHead>حقوق پایه</TableHead>
                  <TableHead>کمیسیون</TableHead>
                  <TableHead>درآمد ماهانه</TableHead>
                  <TableHead>امتیاز</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      کارمندی برای نمایش یافت نشد
                    </TableCell>
                  </TableRow>
                )}
                {filteredEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{getEmployeeDisplayName(employee)}</TableCell>
                    <TableCell>
                      {employee.specialty || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {employee.phone || employee.user?.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(employee.email ?? employee.user?.email) ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {employee.email ?? employee.user?.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <EmployeeServicesDisplay 
                        services={employee.services} 
                        maxDisplay={2}
                      />
                    </TableCell>
                    <TableCell>{toThousandTomans(employee.baseSalary)}</TableCell>
                    <TableCell>{employee.commissionRate}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {toThousandTomans(0)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        0.0
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={(employee.status || 'active') === 'active' ? 'success' : 'outline'}
                      >
                        {(employee.status || 'active') === 'active' ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(employee)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenServicesDialog(employee)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteEmployee(employee.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>ویرایش کارمند</DialogTitle>
            <DialogDescription>
              اطلاعات کارمند را ویرایش کنید
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="edit-name">نام و نام خانوادگی *</label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="نام و نام خانوادگی"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-phone">شماره موبایل *</label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="09123456789"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-email">ایمیل (اختیاری)</label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                placeholder="example@email.com"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleEditEmployee} className="bg-main-orange hover:bg-main-orange/90">
              ذخیره تغییرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Services Management Dialog */}
      <Dialog open={isServicesDialogOpen} onOpenChange={setIsServicesDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>مدیریت خدمات کارمند</DialogTitle>
            <DialogDescription>
              خدمات قابل ارائه توسط {getEmployeeDisplayName(selectedEmployee)} را انتخاب کنید
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid gap-3">
              {availableServices.map((service) => (
                <div key={service.id} className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    id={`service-${service.id}`}
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedServiceIds([...selectedServiceIds, service.id])
                      } else {
                        setSelectedServiceIds(selectedServiceIds.filter(id => id !== service.id))
                      }
                    }}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor={`service-${service.id}`} className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{service.name}</span>
                      <div className="text-sm text-muted-foreground">
                        <span>{service.durationMinutes} دقیقه</span>
                        <span className="mx-2">•</span>
                        <span>{toThousandTomans(service.price)}</span>
                      </div>
                    </div>
                    {service.description && (
                      <div className="text-sm text-muted-foreground">{service.description}</div>
                    )}
                  </label>
                </div>
              ))}
            </div>
            
            {availableServices.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                هیچ خدمتی یافت نشد
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsServicesDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleAssignServices} className="bg-main-orange hover:bg-main-orange/90">
              ذخیره تغییرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
