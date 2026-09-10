"use client"

import { useState, useEffect, useMemo } from 'react'
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
  Download,
  History,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useToast } from '@/components/ui/use-toast'
import axios from '@/lib/axios'
import { queueCustomerQuick, shouldUseOfflineQueue } from '@/lib/offline/sync-worker'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { formatToJalali, parseFromJalali } from '@/lib/date'
import { formatTomansFromRial } from '@/lib/money'
import {
  type EmployeeListItem,
  getEmployeeDisplayName,
  normalizeEmployeeList,
} from '@/lib/employee'

interface Customer {
  id: number
  userId: number
  name: string
  phone: string
  email?: string
  birthdate?: string
  notes?: string
  preferredEmployeeId?: number | null
  preferredEmployeeName?: string
  preferredEmployeeSpecialty?: string
  totalAppointments: number
  lastAppointment?: string
  createdAt: string
  role: string
  isActive: boolean
}

const SALON_TEAM_VALUE = 'salon-team'

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<EmployeeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterBarber, setFilterBarber] = useState('all')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null)
  const [historyRows, setHistoryRows] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    birthdate: '',
    notes: '',
    preferredEmployeeId: '' as string,
  })

  useEffect(() => {
    fetchCustomers()
    fetchEmployees()
  }, [filterBarber])

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/employees')
      const list = normalizeEmployeeList(response.data?.data ?? response.data ?? [])
      setEmployees(list.filter((e) => e.isActive !== false))
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const params: Record<string, string> = {}
      if (filterBarber !== 'all' && filterBarber !== SALON_TEAM_VALUE) {
        params.preferredEmployeeId = filterBarber
      }
      const response = await axios.get('/customers', { params })
      let mapped = (response.data || []).map((c: any) => ({
        id: c.id,
        userId: c.userId ?? c.user?.id,
        name: c.user?.name,
        phone: c.user?.phone,
        email: c.user?.email,
        birthdate: c.birthdate || '',
        notes: c.notes || '',
        preferredEmployeeId: c.preferredEmployeeId ?? c.preferredEmployee?.id ?? null,
        preferredEmployeeName: c.preferredEmployee?.user?.name || 'تیم سالن',
        preferredEmployeeSpecialty: c.preferredEmployee?.specialty || '',
        createdAt: c.createdAt,
        role: 'CUSTOMER',
        isActive: true,
        totalAppointments: c._count?.appointments ?? c.totalAppointments ?? 0,
      }))
      if (filterBarber === SALON_TEAM_VALUE) {
        mapped = mapped.filter((c: Customer) => c.preferredEmployeeId == null)
      }
      setCustomers(mapped)
    } catch (error) {
      console.error('Error fetching customers:', error)
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری لیست مشتریان',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const openHistory = async (customer: Customer) => {
    setHistoryCustomer(customer)
    setHistoryOpen(true)
    setHistoryLoading(true)
    setHistoryRows([])
    try {
      const response = await axios.get('/appointments', {
        params: { customerId: customer.id, take: 80 },
      })
      setHistoryRows(response.data?.data || response.data || [])
    } catch (error) {
      console.error('Error fetching customer history:', error)
      toast({
        title: 'خطا',
        description: 'بارگذاری تاریخچه نوبت‌ها با خطا مواجه شد',
        variant: 'destructive',
      })
    } finally {
      setHistoryLoading(false)
    }
  }

  const preferredPayload = () => {
    if (!formData.preferredEmployeeId || formData.preferredEmployeeId === SALON_TEAM_VALUE) {
      return null
    }
    return Number(formData.preferredEmployeeId)
  }

  const handleCreateCustomer = async () => {
    try {
      const useOffline = await shouldUseOfflineQueue()
      if (useOffline) {
        await queueCustomerQuick({
          name: formData.name,
          phone: formData.phone,
        })
        toast({
          title: 'مشتری آفلاین',
          description:
            'مشتری به صورت آفلاین ثبت شد و پس از اتصال به سرور همگام‌سازی می‌شود.',
        })
        setIsCreateDialogOpen(false)
        resetForm()
        return
      }

      const preferredEmployeeId = preferredPayload()
      await axios.post('/customers/quick', {
        name: formData.name,
        phone: formData.phone,
        ...(preferredEmployeeId != null ? { preferredEmployeeId } : {}),
      })
      toast({
        title: 'موفق',
        description: 'مشتری با موفقیت اضافه شد',
      })
      setIsCreateDialogOpen(false)
      resetForm()
      fetchCustomers()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در ایجاد مشتری',
        variant: 'destructive',
      })
    }
  }

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return

    if (!selectedCustomer.userId) {
      toast({
        title: 'خطا',
        description: 'شناسه کاربر (userId) برای این مشتری یافت نشد',
        variant: 'destructive',
      })
      return
    }

    const trimmedName = formData.name.trim()
    if (!trimmedName) {
      toast({
        title: 'خطا',
        description: 'نام مشتری الزامی است',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      // Task 1: identity fields go to User API with userId (never customer.id)
      await axios.patch(`/users/${selectedCustomer.userId}`, {
        name: trimmedName,
        phone: formData.phone.trim(),
        email: formData.email || undefined,
      })

      // Preferred barber + customer-only fields via Customers API (customer.id)
      await axios.patch(`/customers/${selectedCustomer.id}`, {
        birthdate: formData.birthdate || undefined,
        notes: formData.notes || null,
        preferredEmployeeId: preferredPayload(),
      })

      toast({
        title: 'موفق',
        description: 'اطلاعات مشتری با موفقیت به‌روزرسانی شد',
      })
      setIsEditDialogOpen(false)
      resetForm()
      fetchCustomers()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در به‌روزرسانی مشتری',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCustomer = async (customerId: number) => {
    if (!confirm('آیا از حذف این مشتری اطمینان دارید؟')) return

    try {
      await axios.delete(`/customers/${customerId}`)
      toast({
        title: 'موفق',
        description: 'مشتری با موفقیت حذف شد',
      })
      fetchCustomers()
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در حذف مشتری',
        variant: 'destructive',
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
      preferredEmployeeId: '',
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
      preferredEmployeeId:
        customer.preferredEmployeeId != null
          ? String(customer.preferredEmployeeId)
          : SALON_TEAM_VALUE,
    })
    setIsEditDialogOpen(true)
  }

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      (customer.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.phone || '').includes(searchTerm) ||
      (customer.email &&
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'active' && customer.isActive) ||
      (filterStatus === 'inactive' && !customer.isActive)

    return matchesSearch && matchesFilter
  })

  const PreferredBarberSelect = () => (
    <div className="grid gap-2">
      <label className="text-sm font-medium">آرایشگر ترجیحی</label>
      <Select
        value={formData.preferredEmployeeId || SALON_TEAM_VALUE}
        onValueChange={(v) => setFormData({ ...formData, preferredEmployeeId: v })}
        disabled={employees.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder="انتخاب آرایشگر" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SALON_TEAM_VALUE}>تیم سالن (بدون اختصاص)</SelectItem>
          {employees.map((emp) => (
            <SelectItem key={emp.id} value={String(emp.id)}>
              {getEmployeeDisplayName(emp)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        این فیلد مالکیت مشتری برای «مشتریان من» را مشخص می‌کند.
      </p>
    </div>
  )

  const preferredDistribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of customers) {
      const key =
        c.preferredEmployeeId == null
          ? 'تیم سالن'
          : c.preferredEmployeeName || `آرایشگر #${c.preferredEmployeeId}`
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [customers])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-main-orange"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">مدیریت مشتریان</h1>
          <p className="text-muted-foreground mt-2">مدیریت مشتریان سالن زیبایی</p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-main-orange hover:bg-main-orange/90 text-foreground"
        >
          <Plus className="h-4 w-4 ml-2" />
          مشتری جدید
        </Button>
      </div>

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
            <div className="text-2xl font-bold">
              {customers.filter((c) => c.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">بدون آرایشگر (تیم سالن)</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers.filter((c) => c.preferredEmployeeId == null).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>توزیع مشتریان بر اساس آرایشگر ترجیحی</CardTitle>
          <CardDescription>
            تعداد مشتریان اختصاص‌یافته به هر آرایشگر به‌همراه تیم سالن
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preferredDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              داده‌ای برای نمایش وجود ندارد
            </p>
          ) : (
            <div className="h-[280px] w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={preferredDistribution}
                  margin={{ top: 8, right: 12, left: 4, bottom: 48 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                    height={60}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [
                      new Intl.NumberFormat('fa-IR').format(value),
                      'مشتری',
                    ]}
                    labelFormatter={(label) => String(label)}
                  />
                  <Bar dataKey="count" name="مشتری" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="w-full md:w-56">
              <Select value={filterBarber} onValueChange={setFilterBarber}>
                <SelectTrigger>
                  <SelectValue placeholder="فیلتر آرایشگر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه آرایشگران</SelectItem>
                  <SelectItem value={SALON_TEAM_VALUE}>تیم سالن (بدون آرایشگر)</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {getEmployeeDisplayName(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  <TableHead>نوبت‌ها</TableHead>
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
                        <span className="font-medium">
                          {customer.preferredEmployeeName || 'تیم سالن'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {customer.preferredEmployeeSpecialty}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {customer.totalAppointments.toLocaleString('fa-IR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={customer.isActive ? 'success' : 'outline'}>
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
                          onClick={() => openHistory(customer)}
                        >
                          <History className="h-4 w-4" />
                          <span className="hidden sm:inline mr-1">تاریخچه</span>
                        </Button>
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>مشتری جدید</DialogTitle>
            <DialogDescription>
              نام، شماره موبایل و آرایشگر ترجیحی را وارد کنید
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
            <PreferredBarberSelect />
          </div>
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              انصراف
            </Button>
            <Button
              onClick={handleCreateCustomer}
              className="bg-main-orange hover:bg-main-orange/90"
            >
              ثبت مشتری
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>ویرایش مشتری</DialogTitle>
            <DialogDescription>
              نام از طریق شناسه کاربر ({selectedCustomer?.userId ?? '—'}) و آرایشگر
              ترجیحی از طریق شناسه مشتری ({selectedCustomer?.id ?? '—'}) ذخیره می‌شود.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="edit-name">نام و نام خانوادگی *</label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="نام و نام خانوادگی"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-phone">شماره موبایل *</label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="09123456789"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="edit-email">ایمیل (اختیاری)</label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@email.com"
              />
            </div>
            <PreferredBarberSelect />
            <div className="grid gap-2">
              <PersianDatePicker
                value={formData.birthdate ? formatToJalali(formData.birthdate) : ''}
                onChange={(date) => {
                  const gregorianDate = parseFromJalali(date)
                  setFormData({
                    ...formData,
                    birthdate: gregorianDate
                      ? gregorianDate.toISOString().split('T')[0]
                      : '',
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
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="یادداشت‌های اضافی"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2 space-x-reverse">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              انصراف
            </Button>
            <Button
              onClick={handleEditCustomer}
              disabled={saving || !formData.name.trim()}
              className="bg-main-orange hover:bg-main-orange/90"
            >
              {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تاریخچه نوبت‌ها</DialogTitle>
            <DialogDescription>
              {historyCustomer?.name || 'مشتری'}
              {historyCustomer
                ? ` — ${historyCustomer.totalAppointments.toLocaleString('fa-IR')} نوبت`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {historyLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : historyRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">نوبتی ثبت نشده است</p>
          ) : (
            <div className="space-y-3">
              {historyRows.map((row) => {
                const services = Array.isArray(row.services)
                  ? row.services.map((s: any) => s.serviceName || s.name).filter(Boolean).join('، ')
                  : row.serviceName || 'خدمت'
                return (
                  <div key={row.id} className="border rounded-lg p-3 text-sm space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{services || 'خدمت'}</span>
                      <Badge variant="outline">{row.status}</Badge>
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-3">
                      <span>
                        {row.calendarDate?.jalaliDate ||
                          (row.scheduledAt ? formatToJalali(row.scheduledAt) : '—')}
                      </span>
                      <span>{row.employeeName || row.employee?.user?.name || 'آرایشگر'}</span>
                      <span>{formatTomansFromRial(row.amount ?? row.serviceAmount ?? 0)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
