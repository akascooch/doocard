"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { OtpInput } from '@/components/auth/OtpInput'
import { getCurrentUser, isAuthenticated, persistAuthSession } from '@/lib/auth'
import { getErrorMessage } from '@/lib/error-handler'
import { normalizeIranMobileClient } from '@/components/customers/QuickRegisterCustomerForm'
import { getCurrentJalaliDate, parseFromJalali, persianToEnglishDigits } from '@/lib/date'
import api from '@/lib/axios'
import {
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
  name?: string
  specialty?: string
  appointmentCount?: number
  user?: {
    id: number
    name: string
  }
}

interface TimeSlot {
  time: string
  displayTime: string
  available?: boolean
}

const IRAN_MOBILE_RE = /^09\d{9}$/

export default function BookAppointmentPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [identitySkipped, setIdentitySkipped] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [otpCode, setOtpCode] = useState('')

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    serviceId: '',
    employeeId: '',
    appointmentDate: '',
    appointmentTime: ''
  })

  useEffect(() => {
    fetchServices()
    const preset = new URLSearchParams(window.location.search).get('employeeId')
    if (preset) {
      setFormData((prev) => ({ ...prev, employeeId: preset }))
    }

    const skipIfLoggedIn = async () => {
      if (!isAuthenticated() || !getCurrentUser()) return
      try {
        await api.get('/customers/me')
        setIdentitySkipped(true)
        setStep(2)
      } catch {
        // Not a customer profile — keep OTP/identity step
      }
    }
    void skipIfLoggedIn()
  }, [])

  useEffect(() => {
    if (formData.serviceId) {
      void fetchEmployeesByService(parseInt(formData.serviceId, 10))
    }
  }, [formData.serviceId])

  useEffect(() => {
    if (formData.appointmentDate && formData.employeeId) {
      void fetchTimeSlots()
    }
  }, [formData.appointmentDate, formData.employeeId])

  const fetchServices = async () => {
    try {
      const response = await fetch('/api/services/public')
      if (response.ok) {
        const data = await response.json()
        setServices(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching services:', error)
    }
  }

  const fetchEmployeesByService = async (serviceId: number) => {
    try {
      const response = await fetch(`/api/employees/by-service/${serviceId}`)
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data) ? data : []
        setEmployees(list)
        if (list.length > 0) {
          setFormData((prev) => {
            const stillValid = list.some((e: Employee) => String(e.id) === prev.employeeId)
            return stillValid ? prev : { ...prev, employeeId: String(list[0].id) }
          })
        } else {
          setFormData((prev) => ({ ...prev, employeeId: '' }))
        }
      }
    } catch (error) {
      console.error('Error fetching employees:', error)
    }
  }

  const fetchTimeSlots = async () => {
    if (!formData.appointmentDate || !formData.employeeId) return
    const gregorianDate = parseFromJalali(formData.appointmentDate)
    if (!gregorianDate) return

    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const dateStr = formatter.format(gregorianDate)

    try {
      const response = await fetch(
        `/api/appointments/slots?date=${dateStr}&employeeId=${formData.employeeId}&durationMin=60&slotIntervalMin=30`
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

  const requestOtp = async () => {
    const phone = normalizeIranMobileClient(formData.customerPhone)
    if (!formData.customerName.trim() || formData.customerName.trim().length < 2) {
      toast({ title: 'خطا', description: 'نام را وارد کنید', variant: 'destructive' })
      return
    }
    if (!IRAN_MOBILE_RE.test(phone)) {
      toast({ title: 'خطا', description: 'شماره موبایل معتبر نیست', variant: 'destructive' })
      return
    }
    setOtpSending(true)
    try {
      await api.post('/auth/otp/request', { phone, purpose: 'BOOKING' })
      setOtpSent(true)
      handleInputChange('customerPhone', phone)
      toast({ title: 'کد ارسال شد', description: 'کد تأیید پیامک شده را وارد کنید.' })
    } catch (error: any) {
      toast({
        title: 'ارسال کد ناموفق',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setOtpSending(false)
    }
  }

  const verifyOtpAndContinue = async () => {
    const phone = normalizeIranMobileClient(formData.customerPhone)
    if (!otpCode || otpCode.length < 4) {
      toast({ title: 'خطا', description: 'کد تأیید را وارد کنید', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const response = await api.post('/auth/otp/verify', {
        phone,
        code: otpCode,
        purpose: 'BOOKING',
        name: formData.customerName.trim(),
      })
      persistAuthSession(response.data)
      setIdentitySkipped(true)
      setStep(2)
    } catch (error: any) {
      toast({
        title: 'تأیید ناموفق',
        description: getErrorMessage(error),
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (step === 1) {
      if (identitySkipped) {
        setStep(2)
        return
      }
      if (!otpSent) {
        void requestOtp()
        return
      }
      void verifyOtpAndContinue()
      return
    }
    if (step === 2 && formData.serviceId && formData.employeeId) {
      setStep(3)
    } else if (step === 3 && formData.appointmentTime) {
      void handleSubmit()
    }
  }

  const handlePrev = () => {
    if (step === 2 && identitySkipped) return
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    try {
      setLoading(true)
      const customerRes = await api.get('/customers/me')
      const customerId = customerRes.data.id
      const selected = services.find(s => s.id.toString() === formData.serviceId)
      if (!selected) throw new Error('خدمت انتخاب نشده است')

      let timeStr = formData.appointmentTime
      if (timeStr.includes(':')) {
        const [h, m] = timeStr.split(':')
        timeStr = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`
      }

      const jalaliDateFormatted = persianToEnglishDigits(formData.appointmentDate).replace(/\//g, '-')
      await api.post('/appointments', {
        services: [{
          serviceId: selected.id,
          priceAtBooking: selected.price,
          durationMin: selected.durationMinutes || 60,
        }],
        employeeId: parseInt(formData.employeeId, 10),
        customerId,
        jalaliDate: jalaliDateFormatted,
        time: timeStr,
      })

      toast({
        title: 'موفقیت',
        description: 'نوبت شما با موفقیت ثبت شد. منتظر تایید باشید.',
      })
      router.push('/dashboard/customer')
    } catch (error: any) {
      console.error('Error booking appointment:', error)
      toast({
        title: 'خطا',
        description: getErrorMessage(error) || 'خطا در ثبت نوبت. لطفاً دوباره تلاش کنید.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedService = services.find(s => s.id.toString() === formData.serviceId)
  const canGoNext =
    step === 1
      ? identitySkipped || (!otpSent && formData.customerName.trim().length >= 2 && formData.customerPhone.length >= 10) || (otpSent && otpCode.length >= 4)
      : step === 2
        ? Boolean(formData.serviceId && formData.employeeId)
        : Boolean(formData.appointmentTime)

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">رزرو نوبت آنلاین</h1>
          <p className="text-xl text-muted-foreground">نوبت خود را به راحتی و سریع رزرو کنید</p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4 space-x-reverse">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {num}
                </div>
                {num < 3 && <div className={`w-16 h-1 mx-2 ${step > num ? 'bg-primary' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>
        </div>

        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">
              {step === 1 && 'تأیید شماره موبایل'}
              {step === 2 && 'انتخاب خدمت و آرایشگر'}
              {step === 3 && 'انتخاب زمان'}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 1 && (identitySkipped ? 'هویت شما از حساب کاربری خوانده شد' : 'کد تأیید پیامکی برای ثبت نوبت لازم است')}
              {step === 2 && 'خدمت مورد نظر و آرایشگر را انتخاب کنید'}
              {step === 3 && 'زمان مناسب را انتخاب کنید'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && !identitySkipped && (
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
                    dir="ltr"
                    value={formData.customerPhone}
                    onChange={(e) => handleInputChange('customerPhone', e.target.value)}
                  />
                </div>
                {otpSent ? (
                  <OtpInput value={otpCode} onChange={setOtpCode} autoFocus />
                ) : null}
              </div>
            )}

            {step === 1 && identitySkipped && (
              <p className="text-sm text-muted-foreground text-center">در حال انتقال به انتخاب خدمت…</p>
            )}

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
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee">آرایشگر مورد نظر *</Label>
                  <Select
                    value={formData.employeeId || undefined}
                    onValueChange={(value) => handleInputChange('employeeId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="آرایشگر مورد نظر را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
                          {employee?.user?.name || employee?.name || 'آرایشگر نامشخص'}
                          {employee?.specialty ? ` - ${employee.specialty}` : ''}
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
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <PersianDatePicker
                  value={formData.appointmentDate}
                  onChange={(date) => handleInputChange('appointmentDate', date)}
                  label="انتخاب تاریخ *"
                  placeholder="تاریخ را انتخاب کنید"
                  minDate={getCurrentJalaliDate()}
                  required
                />
                <div className="space-y-2">
                  <Label>انتخاب زمان *</Label>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {timeSlots.map((slot) => (
                      <Button
                        key={slot.time}
                        type="button"
                        variant={formData.appointmentTime === slot.time ? "default" : "outline"}
                        disabled={slot.available === false}
                        onClick={() => handleInputChange('appointmentTime', slot.time)}
                        className="text-sm min-h-11"
                      >
                        {slot.displayTime}
                      </Button>
                    ))}
                  </div>
                  {timeSlots.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      برای این تاریخ و آرایشگر، زمان خالی موجود نیست.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={step === 1 || (step === 2 && identitySkipped)}
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                قبلی
              </Button>
              <Button onClick={handleNext} disabled={loading || otpSending || !canGoNext}>
                {step === 3 ? (loading ? 'در حال ثبت...' : 'ثبت نوبت') : step === 1 && !otpSent && !identitySkipped ? (otpSending ? 'در حال ارسال...' : 'ارسال کد') : step === 1 && otpSent ? (loading ? 'در حال تأیید...' : 'تأیید و ادامه') : 'بعدی'}
                {step !== 3 && <ArrowLeft className="w-4 h-4 mr-2" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
