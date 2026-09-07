"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Calendar, 
  Clock, 
  Users, 
  ArrowRight,
  ArrowLeft,
  Plus,
  UserPlus
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getCurrentUser } from '@/lib/auth'
import axios from '@/lib/axios'
import { PersianDatePicker } from '@/components/ui/persian-date-picker'
import MoneyInput from '@/components/ui/MoneyInput'
import { toThousandTomans } from '@/lib/money'
import { type EmployeeListItem, getEmployeeDisplayName, normalizeEmployeeList } from '@/lib/employee'

interface Customer {
  id: number
  name: string
  phone: string
  email?: string
}

type Employee = EmployeeListItem

interface Service {
  id: number
  name: string
  price: number
  duration: number
  category?: {
    name: string
  }
}

export default function NewAppointmentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [selectedTime, setSelectedTime] = useState('')
  const [availableSlots, setAvailableSlots] = useState<{ time: string; displayTime: string }[]>([])
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickLoading, setQuickLoading] = useState(false)
  const initialFormState = {
    customerId: '',
    employeeId: '',
    serviceId: '',
    appointmentDate: '',
    appointmentTime: '',
    notes: '',
    totalAmount: 0,
    paidAmount: 0,
    tipAmount: 0
  }
  const [formData, setFormData] = useState(initialFormState)
  const timeSlotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      // Check if user is admin
      if (currentUser.role !== 'ADMIN') {
        router.push('/dashboard/unauthorized')
        return
      }
    } else {
      router.push('/login')
      return
    }

    fetchCustomers()
    fetchEmployees()
    fetchServices()
  }, [router])

  const fetchCustomers = async () => {
    try {
      const response = await axios.get('/customers')
      const list = (response.data || []).map((c: any) => ({
        id: c.id,
        name: c.user?.name ?? '',
        phone: c.user?.phone ?? '',
        email: c.user?.email,
      }))
      setCustomers(list)
    } catch (error) {
      console.error('Error fetching customers:', error)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await axios.get('/employees')
      setEmployees(normalizeEmployeeList(response.data))
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchServices = async () => {
    try {
      const response = await axios.get('/services', { params: { sort: 'usage' } })
      setServices(response.data)
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const fetchAvailableSlots = async (date: string, employeeId: string) => {
    try {
      const response = await axios.get(
        `/appointments/available-slots?date=${date}&employeeId=${employeeId}&durationMin=60&slotIntervalMin=30`
      )
      const slots = response.data?.slots ?? []
      const available = slots.filter((s: { available?: boolean }) => s.available !== false)
      setAvailableSlots(
        available.map((s: { time: string; displayTime: string }) => ({
          time: s.time,
          displayTime: s.displayTime,
        }))
      )
    } catch (error) {
      console.error('Error fetching available slots:', error)
      setAvailableSlots([])
    }
  }

  const handleDateChange = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date && formData.employeeId) {
      const dateString = date.toISOString().split('T')[0]
      setFormData({ ...formData, appointmentDate: dateString })
      fetchAvailableSlots(dateString, formData.employeeId)
    }
  }

  const handleEmployeeChange = (employeeId: string) => {
    setFormData({ ...formData, employeeId })
    if (selectedDate) {
      const dateString = selectedDate.toISOString().split('T')[0]
      fetchAvailableSlots(dateString, employeeId)
    }
  }

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id.toString() === serviceId)
    setFormData({ 
      ...formData, 
      serviceId,
      totalAmount: service ? service.price : 0
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.customerId || !formData.employeeId || !formData.serviceId || !formData.appointmentDate || !formData.appointmentTime) {
      toast({
        title: 'خطا',
        description: 'لطفاً تمام فیلدهای الزامی را پر کنید',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const appointmentData = {
        ...formData,
        customerId: Number(formData.customerId),
        employeeId: parseInt(formData.employeeId),
        serviceId: parseInt(formData.serviceId),
        totalAmount: parseFloat(formData.totalAmount.toString()),
        paidAmount: parseFloat(formData.paidAmount.toString()),
        tipAmount: parseFloat(formData.tipAmount.toString())
      }

      await axios.post('/appointments', appointmentData)
      
      toast({
        title: 'موفق',
        description: 'نوبت با موفقیت ثبت شد'
      })

      setFormData(prev => ({ ...prev, appointmentTime: '' }))
      if (formData.employeeId && formData.appointmentDate) {
        fetchAvailableSlots(formData.appointmentDate, formData.employeeId)
      }
      setTimeout(() => {
        timeSlotRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        const trigger = timeSlotRef.current?.querySelector('button')
        if (trigger) (trigger as HTMLButtonElement).focus()
      }, 100)
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در ثبت نوبت',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedService = services.find(s => s.id.toString() === formData.serviceId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
          >
            <ArrowRight className="h-4 w-4 ml-2" />
            بازگشت
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              ثبت نوبت جدید
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              ایجاد نوبت جدید برای مشتری
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>اطلاعات نوبت</CardTitle>
          <CardDescription>
            اطلاعات نوبت جدید را وارد کنید
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="customer">مشتری *</Label>
                  <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="sm" className="gap-1">
                        <UserPlus className="h-4 w-4" />
                        ثبت مشتری سریع
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle>ثبت مشتری سریع</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="quick-name">نام *</Label>
                          <Input
                            id="quick-name"
                            value={quickName}
                            onChange={(e) => setQuickName(e.target.value)}
                            placeholder="نام و نام خانوادگی"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="quick-phone">شماره موبایل *</Label>
                          <Input
                            id="quick-phone"
                            value={quickPhone}
                            onChange={(e) => setQuickPhone(e.target.value)}
                            placeholder="09123456789"
                          />
                        </div>
                        <Button
                          type="button"
                          disabled={quickLoading || !quickName.trim() || !quickPhone.trim()}
                          onClick={async () => {
                            setQuickLoading(true)
                            try {
                              const res = await axios.post('/customers/quick', {
                                name: quickName.trim(),
                                phone: quickPhone.trim().replace(/\s/g, ''),
                              })
                              const c = res.data
                              const newCustomer = {
                                id: c.id,
                                name: c.user?.name ?? quickName.trim(),
                                phone: c.user?.phone ?? quickPhone.trim(),
                                email: c.user?.email,
                              }
                              setCustomers((prev) => [newCustomer, ...prev])
                              setFormData((prev) => ({ ...prev, customerId: String(c.id) }))
                              setQuickOpen(false)
                              setQuickName('')
                              setQuickPhone('')
                              toast({ title: 'موفق', description: 'مشتری با موفقیت اضافه شد' })
                            } catch (err: any) {
                              toast({
                                title: 'خطا',
                                description: err.response?.data?.message || 'خطا در ثبت مشتری',
                                variant: 'destructive',
                              })
                            } finally {
                              setQuickLoading(false)
                            }
                          }}
                        >
                          {quickLoading ? 'در حال ثبت...' : 'ثبت'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <Select value={formData.customerId} onValueChange={(value) => setFormData({...formData, customerId: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب مشتری" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={String(customer.id)}>
                        {customer.name} - {customer.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee Selection */}
              <div className="space-y-2">
                <Label htmlFor="employee">کارمند *</Label>
                <Select value={formData.employeeId} onValueChange={handleEmployeeChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب کارمند" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {getEmployeeDisplayName(employee)}{employee.specialty ? ` - ${employee.specialty}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Service Selection */}
              <div className="space-y-2">
                <Label htmlFor="service">خدمت *</Label>
                <Select value={formData.serviceId} onValueChange={handleServiceChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب خدمت" />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id.toString()}>
                        {service.name} - {service.price.toLocaleString('fa-IR')} تومان
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label>تاریخ نوبت *</Label>
                <PersianDatePicker
                  value={selectedDate}
                  onChange={handleDateChange}
                  placeholder="انتخاب تاریخ"
                />
              </div>

              {/* Time Selection */}
              <div ref={timeSlotRef} className="space-y-2">
                <Label htmlFor="time">ساعت نوبت *</Label>
                <Select value={formData.appointmentTime} onValueChange={(value) => setFormData({...formData, appointmentTime: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب ساعت" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSlots.map((slot) => (
                      <SelectItem key={slot.time} value={slot.time}>
                        {slot.displayTime}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Total Amount */}
              <div className="space-y-2">
                <MoneyInput
                  value={formData.totalAmount}
                  onChange={(rials) => setFormData({...formData, totalAmount: rials})}
                  label="مبلغ کل"
                  placeholder="مثال: 125,000"
                />
                {selectedService && (
                  <p className="text-sm text-gray-500">
                    قیمت پیش‌فرض: {toThousandTomans(selectedService.price)}
                  </p>
                )}
              </div>

              {/* Paid Amount */}
              <div className="space-y-2">
                <MoneyInput
                  value={formData.paidAmount}
                  onChange={(rials) => setFormData({...formData, paidAmount: rials})}
                  label="مبلغ پرداخت شده"
                  placeholder="مثال: 125,000"
                />
              </div>

              {/* Tip Amount */}
              <div className="space-y-2">
                <MoneyInput
                  value={formData.tipAmount}
                  onChange={(rials) => setFormData({...formData, tipAmount: rials})}
                  label="انعام"
                  placeholder="مثال: 10,000"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">یادداشت (اختیاری)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="یادداشت‌های اضافی..."
                rows={3}
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                انصراف
              </Button>
              <Button
                type="submit"
                className="doocard-gradient hover:opacity-90"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    در حال ثبت...
                  </div>
                ) : (
                  <>
                    <Plus className="ml-2 h-4 w-4" />
                    ثبت نوبت
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
