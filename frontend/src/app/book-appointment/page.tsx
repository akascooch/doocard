"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { PersianDatePicker } from '@/components/ui/persian-date-picker'
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  CheckCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react'

interface Service {
  id: number
  name: string
  description: string
  durationMinutes: number
  price: number
}

interface Employee {
  id: number
  specialty: string
  user: {
    id: number
    name: string
  }
}

interface TimeSlot {
  time: string
  displayTime: string
}

export default function BookAppointmentPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    serviceId: '',
    employeeId: '',
    appointmentDate: '',
    appointmentTime: ''
  })

  useEffect(() => {
    fetchServices()
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (selectedDate && formData.employeeId) {
      fetchTimeSlots()
    }
  }, [selectedDate, formData.employeeId])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services/public')
      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees/public')
      if (response.ok) {
        const data = await response.json()
        setEmployees(data)
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchTimeSlots = async () => {
    if (!selectedDate || !formData.employeeId) return

    try {
      const dateStr = selectedDate.toISOString().split('T')[0]
      const response = await fetch(
        `/api/appointments/available-slots?date=${dateStr}&employeeId=${formData.employeeId}&durationMin=60&slotIntervalMin=30`
      )
      if (response.ok) {
        const data = await response.json()
        setTimeSlots(data.slots || [])
      }
    } catch (error) {
      console.error('Error fetching time slots:', error)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleDateChange = (date: Date) => {
    setSelectedDate(date)
    setFormData(prev => ({
      ...prev,
      appointmentDate: date.toISOString()
    }))
  }

  const handleNext = () => {
    if (step === 1 && formData.customerName && formData.customerPhone) {
      setStep(2)
    } else if (step === 2 && formData.serviceId && formData.employeeId) {
      setStep(3)
    } else if (step === 3 && formData.appointmentTime) {
      handleSubmit()
    }
  }

  const handlePrev = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      
      const appointmentData = {
        ...formData,
        appointmentDate: new Date(selectedDate.toISOString().split('T')[0] + 'T' + formData.appointmentTime).toISOString()
      }

      const response = await fetch('/api/appointments/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appointmentData),
      })

      if (response.ok) {
        toast({
          title: 'موفقیت',
          description: 'نوبت شما با موفقیت ثبت شد. منتظر تایید باشید.',
        })
        router.push('/')
      } else {
        throw new Error('Failed to book appointment')
      }
    } catch (error) {
      console.error('Error booking appointment:', error)
      toast({
        title: 'خطا',
        description: 'خطا در ثبت نوبت. لطفاً دوباره تلاش کنید.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedService = services.find(s => s.id.toString() === formData.serviceId)
  const selectedEmployee = employees.find(e => e.id.toString() === formData.employeeId)

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            رزرو نوبت آنلاین
          </h1>
          <p className="text-xl text-muted-foreground">
            نوبت خود را به راحتی و سریع رزرو کنید
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4 space-x-reverse">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  step >= stepNumber 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-card text-card-foreground'
                }`}>
                  {stepNumber}
                </div>
                {stepNumber < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step > stepNumber ? 'bg-primary' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">
              {step === 1 && 'اطلاعات شخصی'}
              {step === 2 && 'انتخاب خدمت و کارمند'}
              {step === 3 && 'انتخاب زمان'}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 1 && 'لطفاً اطلاعات شخصی خود را وارد کنید'}
              {step === 2 && 'خدمت مورد نظر و کارمند را انتخاب کنید'}
              {step === 3 && 'زمان مناسب را انتخاب کنید'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Personal Information */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="customerName">نام و نام خانوادگی *</Label>
                  <Input
                    id="customerName"
                    placeholder="نام و نام خانوادگی خود را وارد کنید"
                    value={formData.customerName}
                    onChange={(e) => handleInputChange('customerName', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerPhone">شماره موبایل *</Label>
                  <Input
                    id="customerPhone"
                    placeholder="09123456789"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerEmail">ایمیل (اختیاری)</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    placeholder="example@email.com"
                    value={formData.customerEmail}
                    onChange={(e) => handleInputChange('customerEmail', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Service and Employee Selection */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="service">خدمت مورد نظر *</Label>
                  <Select onValueChange={(value) => handleInputChange('serviceId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="خدمت مورد نظر را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.map((service) => (
                        <SelectItem key={service.id} value={service.id.toString()}>
                          {service.name} - {new Intl.NumberFormat('fa-IR').format(service.price)} تومان
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee">کارمند مورد نظر *</Label>
                  <Select onValueChange={(value) => handleInputChange('employeeId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="کارمند مورد نظر را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee?.user?.name ?? 'آرایشگر نامشخص'} - {employee?.specialty ?? ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedService && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">جزئیات خدمت انتخاب شده:</h4>
                    <p><strong>نام:</strong> {selectedService.name}</p>
                    <p><strong>توضیحات:</strong> {selectedService.description}</p>
                    <p><strong>مدت زمان:</strong> {selectedService.durationMinutes} دقیقه</p>
                    <p><strong>قیمت:</strong> {new Intl.NumberFormat('fa-IR').format(selectedService.price)} تومان</p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Time Selection */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>انتخاب تاریخ *</Label>
                  <PersianDatePicker
                    value={selectedDate}
                    onChange={(date) => {
                      if (date) {
                        handleDateChange(date)
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>انتخاب زمان *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {timeSlots.map((slot) => (
                      <Button
                        key={slot.time}
                        variant={formData.appointmentTime === slot.time ? "default" : "outline"}
                        onClick={() => handleInputChange('appointmentTime', slot.time)}
                        className="text-sm"
                      >
                        {slot.displayTime}
                      </Button>
                    ))}
                  </div>
                  {timeSlots.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      برای این تاریخ و کارمند، زمان خالی موجود نیست.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={step === 1}
              >
                <ArrowRight className="h-4 w-4 ml-2" />
                قبلی
              </Button>
              <Button
                onClick={handleNext}
                disabled={loading}
              >
                {step === 3 ? (
                  <>
                    <CheckCircle className="h-4 w-4 ml-2" />
                    {loading ? 'در حال ثبت...' : 'ثبت نوبت'}
                  </>
                ) : (
                  <>
                    بعدی
                    <ArrowLeft className="h-4 w-4 mr-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
