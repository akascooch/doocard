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
  Users, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Calendar,
  Filter,
  Download,
  Eye
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import axios from '@/lib/axios'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { formatToJalali, parseFromJalali } from '@/lib/date'

interface Customer {
  id: number
  name: string
  phone: string
  email?: string
  birthdate?: string
  notes?: string
  totalAppointments: number
  lastAppointment?: string
  createdAt: string
  role: string
  isActive: boolean
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const { toast } = useToast()

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthdate: '',
    notes: '',
    role: 'CUSTOMER'
  })

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/customers')
      const mapped = (response.data || []).map((c: any) => ({
        id: c.id,
        name: c.user?.name,
        phone: c.user?.phone,
        email: c.user?.email,
        birthdate: c.birthdate || '',
        notes: c.notes || '',
        createdAt: c.createdAt,
        role: 'CUSTOMER',
        isActive: true,
        preferredEmployeeName: c.preferredEmployee?.user?.name || 'تیم سالن',
        preferredEmployeeSpecialty: c.preferredEmployee?.specialty || '',
      }))
      setCustomers(mapped)
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری لیست مشتریان',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCustomer = async () => {
    try {
      await axios.post('/customers/quick', {
        name: formData.name,
        phone: formData.phone
      })
      toast({
        title: 'موفق',
        description: 'مشتری با موفقیت اضافه شد'
      })
      setIsCreateDialogOpen(false)
      resetForm()
      fetchCustomers()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در ایجاد مشتری',
        variant: 'destructive'
      })
    }
  }

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return
    
    try {
      const customerData = { ...formData, role: 'CUSTOMER' }
      await axios.patch(`/api/users/${selectedCustomer.id}`, customerData)
      toast({
        title: 'موفق',
        description: 'اطلاعات مشتری با موفقیت به‌روزرسانی شد'
      })
      setIsEditDialogOpen(false)
      resetForm()
      fetchCustomers()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در به‌روزرسانی مشتری',
        variant: 'destructive'
      })
    }
  }

  const handleDeleteCustomer = async (customerId: number) => {
    if (!confirm('آیا از حذف این مشتری اطمینان دارید؟')) return
    
    try {
      await axios.delete(`/api/users/${customerId}`)
      toast({
        title: 'موفق',
        description: 'مشتری با موفقیت حذف شد'
      })
      fetchCustomers()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در حذف مشتری',
        variant: 'destructive'
      })
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      birthdate: '',
      notes: '',
      role: 'CUSTOMER'
    })
    setSelectedCustomer(null)
  }

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer)
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      birthdate: customer.birthdate || '',
      notes: customer.notes || '',
      role: 'CUSTOMER'
    })
    setIsEditDialogOpen(true)
  }

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm) ||
                         (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && customer.isActive) ||
                         (filterStatus === 'inactive' && !customer.isActive)
    
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
            مدیریت مشتریان
          </h1>
          <p className="text-muted-foreground mt-2">
            مدیریت مشتریان سالن زیبایی
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-main-orange hover:bg-main-orange/90 text-foreground">
          <Plus className="h-4 w-4 ml-2" />
          مشتری جدید
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">کل مشتریان</CardTitle>
            <Users className="h-4 w-4 text-main-orange" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مشتریان فعال</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers.filter(c => c.isActive).length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مشتریان جدید</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.filter(c => {
                const createdDate = new Date(c.createdAt)
                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
                return createdDate > thirtyDaysAgo
              }).length}
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
                  placeholder="جستجو بر اساس نام، شماره موبایل یا ایمیل..."
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
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="active">فعال</SelectItem>
                  <SelectItem value="inactive">غیرفعال</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 ml-2" />
              خروجی Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle>لیست مشتریان</CardTitle>
          <CardDescription>
            {filteredCustomers.length} مشتری از {customers.length} مشتری
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>شماره موبایل</TableHead>
                  <TableHead>ایمیل</TableHead>
                    <TableHead>آرایشگر</TableHead>
                    <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ تولد</TableHead>
                  <TableHead>تاریخ عضویت</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {customer.phone}
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          {customer.email}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{(customer as any).preferredEmployeeName || 'تیم سالن'}</span>
                        <span className="text-xs text-muted-foreground">{(customer as any).preferredEmployeeSpecialty}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={customer.isActive ? 'success' : 'outline'}
                      >
                        {customer.isActive ? 'فعال' : 'غیرفعال'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {customer.birthdate ? (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatToJalali(customer.birthdate)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatToJalali(customer.createdAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(customer)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCustomer(customer.id)}
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

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>مشتری جدید</DialogTitle>
            <DialogDescription>
              نام و شماره موبایل مشتری را وارد کنید
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="create-name">نام و نام خانوادگی *</label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="نام و نام خانوادگی"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="create-phone">شماره موبایل *</label>
              <Input
                id="create-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="09123456789"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleCreateCustomer} className="bg-main-orange hover:bg-main-orange/90">
              ثبت مشتری
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>ویرایش مشتری</DialogTitle>
            <DialogDescription>
              اطلاعات مشتری را ویرایش کنید
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
            <div className="grid gap-2">
              <PersianDatePicker
                value={formData.birthdate ? formatToJalali(formData.birthdate) : ''}
                onChange={(date) => {
                  const gregorianDate = parseFromJalali(date)
                  setFormData({
                    ...formData, 
                    birthdate: gregorianDate ? gregorianDate.toISOString().split('T')[0] : ''
                  })
                }}
                label="تاریخ تولد (اختیاری)"
                placeholder="مثال: ۱۳۷۰/۰۱/۰۱"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-notes">یادداشت (اختیاری)</label>
              <Input
                id="edit-notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="یادداشت‌های اضافی"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              انصراف
            </Button>
            <Button onClick={handleEditCustomer} className="bg-main-orange hover:bg-main-orange/90">
              ذخیره تغییرات
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
