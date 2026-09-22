"use client"

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { GlassChip } from '@/components/ui/glass-chip'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import PersianDatePicker from '@/components/ui/PersianDatePicker'
import { PhoneOtpAuth } from '@/components/auth/PhoneOtpAuth'
import { getCurrentUser, isAuthenticated } from '@/lib/auth'
import { getErrorMessage } from '@/lib/error-handler'
import { getCurrentJalaliDate, parseFromJalali, persianToEnglishDigits, tehranHHmmFromIso, slotsApiDateFromPicker } from '@/lib/date'
import {
  clearBookingDraft,
  readBookingDraft,
  writeBookingDraft,
} from '@/lib/booking-draft'
import api from '@/lib/axios'
import {
  PUBLIC_BOOKING_LEAD_HINT_FA,
  isPublicLeadBlockedSlot,
} from '@/lib/booking-lead-time'
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
  reason?: string
}

export default function BookAppointmentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const submittingRef = useRef(false)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [identitySkipped, setIdentitySkipped] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])

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
    const params = new URLSearchParams(window.location.search)
    const preset = params.get('employeeId')
    const draft = readBookingDraft()

    setFormData((prev) => ({
      ...prev,
      ...(draft || {}),
      employeeId: preset || draft?.employeeId || prev.employeeId,
    }))
    if (draft?.step && draft.step >= 1 && draft.step <= 3) {
      setStep(draft.step)
    }

    const skipIfLoggedIn = async () => {
      if (!isAuthenticated() || !getCurrentUser()) return
      try {
        await api.get('/customers/me')
        setIdentitySkipped(true)
      } catch {
        setIdentitySkipped(false)
      }
    }
    void skipIfLoggedIn()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore
  }, [])

  useEffect(() => {
    const hasFields = Boolean(
      formData.serviceId ||
        formData.employeeId ||
        formData.appointmentDate ||
        formData.appointmentTime,
    )
    if (!hasFields) return
    writeBookingDraft({ ...formData, step })
  }, [formData, step])

  useEffect(() => {
    if (formData.serviceId) {
      void fetchEmployeesByService(parseInt(formData.serviceId, 10))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- service change is the input
  }, [formData.serviceId])

  useEffect(() => {
    if (formData.appointmentDate && formData.employeeId) {
      const dateStr = slotsApiDateFromPicker(formData.appointmentDate)
      if (!dateStr) return

      void (async () => {
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
      })()
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

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    try {
      setLoading(true)
      const customerRes = await api.get('/customers/me')
      const customerId = customerRes.data.id
      const selected = services.find(s => s.id.toString() === formData.serviceId)
      if (!selected) throw new Error('خدمت انتخاب نشده است')

      const timeStr = tehranHHmmFromIso(formData.appointmentTime)
      if (!timeStr) {
        toast({
          title: 'خطا',
          description: 'لطفاً زمان شروع نوبت را از اسلات‌های موجود انتخاب کنید.',
          variant: 'destructive',
        })
        return
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

      clearBookingDraft()
      toast({
        title: 'موفقیت',
        description: 'نوبت شما با موفقیت ثبت شد. منتظر تایید باشید.',
      })
      router.push('/dashboard/customer')
    } catch (error: unknown) {
      console.error('Error booking appointment:', error)
      toast({
        title: 'خطا',
        description: getErrorMessage(error as Parameters<typeof getErrorMessage>[0]) || 'خطا در ثبت نوبت. لطفاً دوباره تلاش کنید.',
        variant: 'destructive',
      })
    } finally {
      submittingRef.current = false
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (step === 1 && formData.serviceId && formData.employeeId) {
      setStep(2)
      return
    }
    if (step === 2 && formData.appointmentTime) {
      if (identitySkipped) {
        void handleSubmit()
        return
      }
      setStep(3)
      return
    }
    if (step === 3 && identitySkipped) {
      void handleSubmit()
    }
  }

  const handlePrev = () => {
    if (step > 1) setStep(step - 1)
  }

  const selectedService = services.find(s => s.id.toString() === formData.serviceId)
  const canGoNext =
    step === 1
      ? Boolean(formData.serviceId && formData.employeeId)
      : step === 2
        ? Boolean(formData.appointmentTime)
        : identitySkipped

  return (
    <div className="aurora-public-booking min-h-screen py-8" data-theme="light">
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
              {step === 1 && 'انتخاب خدمت و آرایشگر'}
              {step === 2 && 'انتخاب زمان'}
              {step === 3 && 'تأیید شماره موبایل'}
            </CardTitle>
            <CardDescription className="text-center">
              {step === 1 && 'خدمت مورد نظر و آرایشگر را انتخاب کنید'}
              {step === 2 && 'زمان مناسب را انتخاب کنید'}
              {step === 3 && (identitySkipped
                ? 'هویت شما تأیید شد. نوبت در حال ثبت است.'
                : 'برای ثبت نوبت، کد ۵ رقمی پیامکی را وارد کنید. انتخاب‌های شما حفظ می‌شود.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="service">خدمت مورد نظر *</Label>
                  <Select
                    value={formData.serviceId || undefined}
                    onValueChange={(value) => handleInputChange('serviceId', value)}
                  >
                    <SelectTrigger className="aurora-public-select-trigger">
                      <SelectValue placeholder="خدمت مورد نظر را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent className="aurora-public-select">
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
                    <SelectTrigger className="aurora-public-select-trigger">
                      <SelectValue placeholder="آرایشگر مورد نظر را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent className="aurora-public-select">
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

            {step === 2 && (
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
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-200">
                    {PUBLIC_BOOKING_LEAD_HINT_FA}
                  </p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {timeSlots
                      .filter((slot) => slot.available !== false && !isPublicLeadBlockedSlot(slot))
                      .map((slot) => (
                      <GlassChip
                        key={slot.time}
                        selected={formData.appointmentTime === slot.time}
                        onClick={() => handleInputChange('appointmentTime', slot.time)}
                      >
                        {slot.displayTime}
                        {formData.appointmentTime === slot.time ? (
                          <span className="sr-only">انتخاب شده</span>
                        ) : null}
                      </GlassChip>
                    ))}
                  </div>
                  {timeSlots.filter((slot) => slot.available !== false && !isPublicLeadBlockedSlot(slot)).length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      برای این تاریخ و آرایشگر، زمان خالی موجود نیست.
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 3 && !identitySkipped && (
              <PhoneOtpAuth
                purpose="BOOKING"
                intent="login"
                initialPhone={formData.customerPhone}
                onAuthenticated={(result) => {
                  setIdentitySkipped(true)
                  if (result.user?.name) {
                    handleInputChange('customerName', result.user.name)
                  }
                  if (result.user?.phone) {
                    handleInputChange('customerPhone', result.user.phone)
                  }
                  void handleSubmit()
                }}
              />
            )}

            {step === 3 && identitySkipped && (
              <p className="text-sm text-muted-foreground text-center">در حال ثبت نوبت…</p>
            )}

            <div className="flex justify-between pt-6">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={step === 1 || loading}
              >
                <ArrowRight className="w-4 h-4 ml-2" />
                قبلی
              </Button>
              {step !== 3 || identitySkipped ? (
                <Button onClick={handleNext} disabled={loading || !canGoNext}>
                  {step === 2 && identitySkipped
                    ? (loading ? 'در حال ثبت...' : 'ثبت نوبت')
                    : step === 3
                      ? (loading ? 'در حال ثبت...' : 'ثبت نوبت')
                      : 'بعدی'}
                  {!(step === 2 && identitySkipped) && step !== 3 && <ArrowLeft className="w-4 h-4 mr-2" />}
                </Button>
              ) : (
                <span />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
