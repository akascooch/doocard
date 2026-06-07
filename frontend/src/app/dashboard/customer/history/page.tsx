"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Calendar, 
  Clock, 
  User, 
  Scissors, 
  Search,
  Filter,
  Download,
  Star
} from 'lucide-react'
import { format } from 'date-fns'
import { faIR } from 'date-fns/locale'
import { useToast } from '@/components/ui/use-toast'
import { getCurrentUser } from '@/lib/auth'
import axios from '@/lib/axios'

interface Appointment {
  id: number
  appointmentDate?: string
  scheduledAt?: string
  status: string
  serviceName?: string | null
  serviceDuration?: number | null
  employeeName?: string | null
  serviceAmount?: number
  totalAmount?: number
  service?: {
    id: number
    name: string
    price: number
    durationMinutes: number
  } | null
  employee?: {
    id: number
    user: {
      name: string
    }
    specialty: string
  } | null
  customer: {
    user: {
      name: string
      phone: string
    }
  }
  rating?: number
  review?: string
}

export default function CustomerHistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [filteredAppointments, setFilteredAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      if (currentUser.role !== 'CUSTOMER') {
        router.push(`/dashboard/${currentUser.role.toLowerCase()}`)
        return
      }
    }
    fetchAppointments()
  }, [])

  useEffect(() => {
    filterAppointments()
  }, [appointments, searchTerm, statusFilter, serviceFilter, dateFilter])

  const fetchAppointments = async () => {
    try {
      const token = localStorage.getItem('token')
      // Fetch completed appointments from database
      const response = await fetch('/api/appointments/customer-history', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAppointments(data)
      } else {
        throw new Error('Failed to fetch appointment history')
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
      toast({
        title: 'خطا',
        description: 'خطا در دریافت تاریخچه نوبت‌ها',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const filterAppointments = () => {
    let filtered = appointments

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(appointment => {
        const serviceName =
          appointment.serviceName ?? appointment?.service?.name ?? ''
        const employeeName =
          appointment.employeeName ?? appointment?.employee?.user?.name ?? ''
        const term = searchTerm.toLowerCase()
        return (
          serviceName.toLowerCase().includes(term) ||
          employeeName.toLowerCase().includes(term)
        )
      })
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(appointment => appointment.status === statusFilter)
    }

    // Service filter
    if (serviceFilter !== 'all') {
      filtered = filtered.filter(
        appointment => appointment?.service?.id?.toString() === serviceFilter
      )
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const appointmentDate = new Date()
      
      switch (dateFilter) {
        case 'week':
          appointmentDate.setDate(now.getDate() - 7)
          break
        case 'month':
          appointmentDate.setMonth(now.getMonth() - 1)
          break
        case '3months':
          appointmentDate.setMonth(now.getMonth() - 3)
          break
        case 'year':
          appointmentDate.setFullYear(now.getFullYear() - 1)
          break
      }
      
      filtered = filtered.filter(appointment => {
        const dateValue = appointment.appointmentDate ?? appointment.scheduledAt
        return dateValue ? new Date(dateValue) >= appointmentDate : false
      })
    }

    setFilteredAppointments(filtered)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="default" className="bg-green-100 text-green-800">تکمیل شده</Badge>
      case 'CANCELLED':
        return <Badge variant="destructive">لغو شده</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-400 dark:text-gray-300'
        }`}
      />
    ))
  }

  const getUniqueServices = () => {
    const services = appointments
      .map(a => a.service)
      .filter((service): service is NonNullable<Appointment['service']> => service != null)
    return services.filter((service, index, self) =>
      index === self.findIndex(s => s.id === service.id)
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">تاریخچه نوبت‌ها</h1>
        <p className="text-foreground/80">
          مشاهده و مدیریت تاریخچه نوبت‌های شما
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            فیلترها
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">جستجو</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground/80" />
                <Input
                  placeholder="جستجو در خدمات یا کارکنان..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">وضعیت</label>
              <Select defaultValue={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب وضعیت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="COMPLETED">تکمیل شده</SelectItem>
                  <SelectItem value="CANCELLED">لغو شده</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">خدمت</label>
              <Select defaultValue={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب خدمت" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  {getUniqueServices().map((service) => (
                    <SelectItem key={service.id} value={service.id.toString()}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">بازه زمانی</label>
              <Select defaultValue={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب بازه زمانی" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="week">هفته گذشته</SelectItem>
                  <SelectItem value="month">ماه گذشته</SelectItem>
                  <SelectItem value="3months">۳ ماه گذشته</SelectItem>
                  <SelectItem value="year">سال گذشته</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div className="mr-4">
                <p className="text-sm font-medium text-foreground/80">کل نوبت‌ها</p>
                <p className="text-2xl font-bold">{appointments.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Scissors className="h-6 w-6 text-blue-600" />
              </div>
              <div className="mr-4">
                <p className="text-sm font-medium text-foreground/80">تکمیل شده</p>
                <p className="text-2xl font-bold">
                  {appointments.filter(a => a.status === 'COMPLETED').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Star className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="mr-4">
                <p className="text-sm font-medium text-foreground/80">میانگین امتیاز</p>
                <p className="text-2xl font-bold">
                  {appointments.filter(a => a.rating).length > 0 
                    ? (appointments.filter(a => a.rating).reduce((sum, a) => sum + (a.rating || 0), 0) / 
                       appointments.filter(a => a.rating).length).toFixed(1)
                    : '0'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appointments List */}
      <div className="space-y-4">
        {filteredAppointments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-foreground/80 mb-4" />
              <h3 className="text-lg font-medium mb-2">نوبتی یافت نشد</h3>
              <p className="text-foreground/80 text-center">
                با فیلترهای انتخاب شده نوبتی یافت نشد
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAppointments.map((appointment) => {
            const serviceName =
              appointment.serviceName ??
              appointment.service?.name ??
              'نام سرویس مشخص نیست'
            const employeeName =
              appointment.employeeName ??
              appointment.employee?.user?.name ??
              'آرایشگر نامشخص'
            const serviceDuration =
              appointment.serviceDuration ??
              appointment.service?.durationMinutes ??
              0
            const appointmentDateValue =
              appointment.appointmentDate ?? appointment.scheduledAt
            const displayPrice =
              appointment.service?.price ??
              appointment.totalAmount ??
              appointment.serviceAmount ??
              0

            return (
            <Card key={appointment.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 space-x-reverse">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-medium">{serviceName}</h3>
                        {getStatusBadge(appointment.status)}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-foreground/80 mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {appointmentDateValue
                              ? format(new Date(appointmentDateValue), 'PPP', { locale: faIR })
                              : '—'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span>
                            {appointmentDateValue
                              ? format(new Date(appointmentDateValue), 'HH:mm')
                              : '—'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{employeeName}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Scissors className="h-4 w-4" />
                          <span>{serviceDuration} دقیقه</span>
                        </div>
                      </div>
                      
                      {appointment.rating && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium">امتیاز:</span>
                            <div className="flex">
                              {renderStars(appointment.rating)}
                            </div>
                            <span className="text-sm text-foreground/80">
                              ({appointment.rating}/5)
                            </span>
                          </div>
                          {appointment.review && (
                            <p className="text-sm text-foreground/80 bg-muted p-3 rounded-lg">
                              "{appointment.review}"
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-semibold text-primary mb-2">
                      {displayPrice.toLocaleString('fa-IR')} تومان
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        فاکتور
                      </Button>
                      {!appointment.rating && appointment.status === 'COMPLETED' && (
                        <Button variant="outline" size="sm">
                          <Star className="h-4 w-4 mr-2" />
                          امتیازدهی
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
