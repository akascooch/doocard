"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CalendarCheck,
  AlertCircle
} from 'lucide-react'
import axios from '@/lib/axios'
import { parseFromJalali, persianToEnglishDigits, getCurrentJalaliDate, getJalaliWeekdayName, addDaysToJalali, isJalaliDateBefore, englishToPersianDigits } from '@/lib/date'
import { getCurrentUser } from '@/lib/auth'
import PersianDatePicker from '@/components/ui/PersianDatePicker'

interface Service {
  id: number
  name: string
  description: string
  durationMinutes: number
  price: number
  usageCount?: number // تعداد استفاده در نوبت‌ها
}

interface Employee {
  id: number
  userId: number
  specialty?: string
  user: {
    id: number
    name: string
    phone: string
    email: string
  }
  isDefault?: boolean
  appointmentCount?: number // تعداد نوبت‌ها
}

interface TimeSlot {
  time: string
  displayTime: string
  available?: boolean
  reason?: string
}

interface BookingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function BookingModal({ open, onOpenChange, onSuccess }: BookingModalProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [services, setServices] = useState<Service[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [loadingEmployees, setLoadingEmployees] = useState(false)
  const [preferredEmployeeId, setPreferredEmployeeId] = useState<number | null>(null)
  const [dateMode, setDateMode] = useState<'earliest' | 'manual'>('manual')
  const [loadingEarliest, setLoadingEarliest] = useState(false)
  const [earliestDisplayTime, setEarliestDisplayTime] = useState<string | null>(null)
  const [earliestPreview, setEarliestPreview] = useState<{
    jalaliDate: string
    displayTime: string
  } | null>(null)
  const [loadingEarliestPreview, setLoadingEarliestPreview] = useState(false)

  const [formData, setFormData] = useState({
    serviceId: '',
    employeeId: '',
    appointmentDate: getCurrentJalaliDate(),
    appointmentTime: '',
    notes: ''
  })

  useEffect(() => {
    if (open) {
      fetchServices()
      fetchPreferredEmployee() // Get customer's preferred employee
      // Reset form when modal opens
      setStep(1)
      setEmployees([]) // Clear employees
      setDateMode('manual')
      setEarliestDisplayTime(null)
      setEarliestPreview(null)
      setFormData({
        serviceId: '',
        employeeId: '',
        appointmentDate: getCurrentJalaliDate(),
        appointmentTime: '',
        notes: ''
      })
    }
  }, [open])
  
  const fetchPreferredEmployee = async () => {
    try {
      const customerRes = await axios.get('/customers/me')
      if (customerRes.data && customerRes.data.preferredEmployee) {
        setPreferredEmployeeId(customerRes.data.preferredEmployee.id)
        console.log('👤 Customer preferred employee:', customerRes.data.preferredEmployee.name, '(ID:', customerRes.data.preferredEmployee.id, ')')
      }
    } catch (error) {
      console.log('ℹ️ Could not fetch preferred employee')
    }
  }

  // Fetch employees when service is selected
  useEffect(() => {
    if (formData.serviceId) {
      fetchEmployeesByService(parseInt(formData.serviceId))
    } else {
      setEmployees([])
      setFormData(prev => ({ ...prev, employeeId: '' }))
    }
  }, [formData.serviceId])

  useEffect(() => {
    if (formData.appointmentDate && formData.employeeId && formData.serviceId) {
      setTimeSlots([])
      setFormData(prev => ({ ...prev, appointmentTime: '' }))
      fetchTimeSlots()
    }
  }, [formData.appointmentDate, formData.employeeId, formData.serviceId])

  const fetchServices = async () => {
    try {
      console.log('🔍 Fetching services from /api/services/public...')
      const res = await fetch('/api/services/public')
      console.log('📡 Services response status:', res.status)
      
      if (res.ok) {
        const data = await res.json()
        console.log('✅ Services data:', data)
        const servicesList = Array.isArray(data) ? data : []
        
        // Backend already sorts by usage count (most used first)
        // No need to sort here - use backend order
        setServices(servicesList)
        console.log(`📋 ${servicesList.length} services loaded (sorted by usage count from backend)`)
        
        // Log usage counts for debugging
        if (servicesList.length > 0 && servicesList[0].usageCount !== undefined) {
          console.log('📊 Top 3 services:', servicesList.slice(0, 3).map(s => `${s.name} (${s.usageCount} uses)`))
        }
      } else {
        console.error('❌ Services fetch failed:', res.status, res.statusText)
        const errorText = await res.text()
        console.error('Error body:', errorText)
        toast({
          variant: 'destructive',
          title: 'خطا',
          description: 'خطا در دریافت لیست خدمات'
        })
      }
    } catch (error) {
      console.error('❌ Error fetching services:', error)
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ارتباط با سرور'
      })
    }
  }

  const fetchEmployeesByService = async (serviceId: number) => {
    setLoadingEmployees(true)
    try {
      console.log(`🔍 Fetching employees for service ${serviceId}...`)
      const res = await fetch(`/api/employees/by-service/${serviceId}`)
      console.log('📡 Employees response status:', res.status)
      
      if (res.ok) {
        const data = await res.json()
        console.log('✅ Employees data:', data)
        let employeeList = Array.isArray(data) ? data : []
        
        // Custom sort: Preferred employee first, then by appointment count
        if (preferredEmployeeId) {
          const preferredIndex = employeeList.findIndex(e => e.id === preferredEmployeeId)
          
          if (preferredIndex > 0) {
            // Move preferred employee to first position
            const preferredEmployee = employeeList[preferredIndex]
            employeeList = [
              preferredEmployee,
              ...employeeList.filter(e => e.id !== preferredEmployeeId)
            ]
            console.log('👤 Preferred employee moved to top:', preferredEmployee.user.name)
          } else if (preferredIndex === 0) {
            console.log('👤 Preferred employee already first:', employeeList[0].user.name)
          }
        }
        
        setEmployees(employeeList)
        console.log(`📋 ${employeeList.length} employees loaded (preferred first, then by appointment count)`)
        
        // Log top employees for debugging
        if (employeeList.length > 0) {
          console.log('📊 Employee order:', employeeList.slice(0, 3).map((e, i) => 
            `${i+1}. ${e.user.name}${e.id === preferredEmployeeId ? ' ⭐PREFERRED' : ''}`
          ))
        }
        
        // Auto-select first employee (preferred or most booked)
        if (employeeList.length > 0) {
          const selectedEmployee = employeeList[0]
          setFormData(prev => ({ ...prev, employeeId: String(selectedEmployee.id) }))
          console.log('⭐ Auto-selected employee:', selectedEmployee.user.name, 
            selectedEmployee.id === preferredEmployeeId ? '(preferred employee)' : '(sorted by popularity)')
        } else {
          console.warn('⚠️ No employees found for this service')
        }
      } else {
        console.error('❌ Employees fetch failed:', res.status)
        setEmployees([])
        toast({
          variant: 'destructive',
          title: 'خطا',
          description: 'خطا در دریافت لیست آرایشگران'
        })
      }
    } catch (error) {
      console.error('❌ Error fetching employees by service:', error)
      setEmployees([])
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ارتباط با سرور'
      })
    } finally {
      setLoadingEmployees(false)
    }
  }

  const fetchTimeSlots = async () => {
    if (!formData.appointmentDate || !formData.employeeId) return

    setLoadingSlots(true)
    try {
      // Convert Jalali to Gregorian
      const gregorianDate = parseFromJalali(formData.appointmentDate)
      if (!gregorianDate) {
        toast({
          variant: 'destructive',
          title: 'خطا',
          description: 'تاریخ وارد شده نامعتبر است'
        })
        return
      }

      // Timezone-safe: format selected day in Asia/Tehran so API receives correct calendar day (avoids min_2h on tomorrow in late evening)
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const dateStr = formatter.format(gregorianDate)
      
      console.log(`🔄 Fetching slots for Jalali: ${formData.appointmentDate} → Gregorian: ${dateStr}`)
      
      const res = await fetch(
        `/api/appointments/slots?date=${dateStr}&employeeId=${formData.employeeId}`
      )

      if (res.ok) {
        const data = await res.json()
        // Get ALL slots (including busy ones) with their availability status
        const allSlots: TimeSlot[] = data.slots || []
        setTimeSlots(allSlots)
        
        const availableCount = allSlots.filter(s => s.available !== false).length
        const busyCount = allSlots.length - availableCount
        
        console.log(`🕐 Loaded ${allSlots.length} hourly time slots (${availableCount} available, ${busyCount} busy)`)

        if (availableCount === 0) {
          toast({
            variant: 'destructive',
            title: 'اطلاعیه',
            description: 'در این تاریخ زمان خالی موجود نیست'
          })
        }
      } else {
        toast({
          variant: 'destructive',
          title: 'خطا',
          description: 'خطا در دریافت زمان‌های خالی'
        })
      }
    } catch (error) {
      console.error('Error fetching time slots:', error)
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'خطا در ارتباط با سرور'
      })
    } finally {
      setLoadingSlots(false)
    }
  }

  const fetchEarliestSlot = async (): Promise<boolean> => {
    if (!formData.employeeId || !formData.serviceId) return false
    setLoadingEarliest(true)
    try {
      const res = await fetch(
        `/api/appointments/earliest?employeeId=${formData.employeeId}&serviceId=${formData.serviceId}`
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 404 && data?.message === 'NO_AVAILABLE_SLOT') {
          toast({
            variant: 'destructive',
            title: 'اطلاعیه',
            description: 'در حال حاضر نوبت آزادی وجود ندارد'
          })
          return false
        }
        throw new Error(data?.message || 'خطا در دریافت اولین نوبت')
      }
      const data = await res.json()
      setFormData(prev => ({
        ...prev,
        appointmentDate: data.jalaliDate,
        appointmentTime: data.time
      }))
      setEarliestDisplayTime(data.displayTime ?? null)
      return true
    } catch (err: any) {
      console.error('Earliest slot fetch error:', err)
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: err?.message || 'خطا در دریافت اولین نوبت'
      })
      return false
    } finally {
      setLoadingEarliest(false)
    }
  }

  const fetchEarliestSlotPreview = async () => {
    if (!formData.employeeId || !formData.serviceId) return
    setLoadingEarliestPreview(true)
    try {
      const res = await fetch(
        `/api/appointments/earliest?employeeId=${formData.employeeId}&serviceId=${formData.serviceId}`
      )
      if (!res.ok) {
        setEarliestPreview(null)
        return
      }
      const data = await res.json()
      setEarliestPreview({
        jalaliDate: data.jalaliDate,
        displayTime: data.displayTime
      })
    } catch {
      setEarliestPreview(null)
    } finally {
      setLoadingEarliestPreview(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.serviceId || !formData.employeeId || !formData.appointmentDate || !formData.appointmentTime) {
      toast({
        variant: 'destructive',
        title: 'خطا',
        description: 'لطفاً تمام فیلدهای اجباری را پر کنید'
      })
      return
    }

    setLoading(true)
    try {
      // Get current user and customer ID
      const currentUser = getCurrentUser()
      if (!currentUser) {
        throw new Error('User not logged in')
      }

      // Get customer profile to get customer ID
      const customerRes = await axios.get('/customers/me')
      const customerId = customerRes.data.id

      // Find selected service details
      const selectedService = services.find(s => s.id === parseInt(formData.serviceId))
      if (!selectedService) {
        throw new Error('Selected service not found')
      }

      // Build services payload (format expected by backend)
      const servicesPayload = [{
        serviceId: selectedService.id,
        priceAtBooking: selectedService.price, // Already in RIAL
        durationMin: selectedService.durationMinutes,
      }]

      // Extract time in HH:00 format from ISO datetime (hourly slots only)
      let timeStr = formData.appointmentTime
      
      // If appointmentTime is ISO datetime (e.g., "2025-11-01T14:00:00.000Z"), extract time
      if (timeStr.includes('T')) {
        const timeDate = new Date(timeStr)
        const hours = timeDate.getHours().toString().padStart(2, '0')
        // For hourly slots, always use :00 minutes
        timeStr = `${hours}:00`
      } else if (timeStr.includes(':')) {
        // If already in HH:mm format, ensure it's hourly (round to :00)
        const [h] = timeStr.split(':')
        timeStr = `${h.padStart(2, '0')}:00`
      } else {
        // If just hour number (e.g., "14"), format as HH:00
        timeStr = `${timeStr.padStart(2, '0')}:00`
      }

      // Convert Persian digits to English and format jalali date
      const jalaliDateFormatted = persianToEnglishDigits(formData.appointmentDate).replace(/\//g, '-')

      // Build payload matching AppointmentForm format
      const payload = {
        services: servicesPayload,
        employeeId: parseInt(formData.employeeId),
        customerId: customerId,
        jalaliDate: jalaliDateFormatted, // "YYYY-MM-DD" format (e.g., "1404-08-12")
        time: timeStr, // "HH:mm" format (e.g., "14:30")
        notes: formData.notes || undefined,
      }

      console.log('📤 Submitting appointment (BookingModal):', payload)
      console.log('   - jalaliDate:', payload.jalaliDate)
      console.log('   - time:', payload.time, `(extracted from: ${formData.appointmentTime})`)
      console.log('   - services:', payload.services)
      console.log('   - employeeId:', payload.employeeId)
      console.log('   - customerId:', payload.customerId)

      const response = await axios.post('/appointments', payload)
      console.log('✅ Appointment created:', response.data)

      toast({
        title: '✅ موفقیت',
        description: 'نوبت شما با موفقیت ثبت شد و در انتظار تأیید است'
      })

      onOpenChange(false)

      if (onSuccess) {
        onSuccess()
      }
      // Do NOT reload: keeps auth session; parent can refetch list via onSuccess

    } catch (error: any) {
      console.error('❌ Error booking appointment:', error)
      
      // Extract error message from backend
      const errorMessage = error.response?.data?.message || error.message || 'خطایی رخ داده است'
      
      // Check if it's a slot conflict error
      const isSlotConflict = errorMessage.includes('تداخل') || 
                              errorMessage.includes('رزرو شده') || 
                              errorMessage.toLowerCase().includes('conflict') ||
                              error.response?.status === 409
      
      console.log('🔍 Error details:', {
        message: errorMessage,
        status: error.response?.status,
        isSlotConflict
      })
      
      // Show appropriate error message
      toast({
        variant: 'destructive',
        title: isSlotConflict ? '⚠️ ساعت رزرو شده' : '❌ خطا در رزرو',
        description: isSlotConflict 
          ? 'این ساعت قبلاً رزرو شده است. لطفاً ساعت دیگری انتخاب کنید.'
          : errorMessage
      })
      
      // If slot conflict, refresh time slots to show updated availability
      if (isSlotConflict) {
        console.log('🔄 Refreshing time slots after conflict...')
        await fetchTimeSlots()
      }
    } finally {
      setLoading(false)
    }
  }

  const selectedService = services.find(s => s.id === parseInt(formData.serviceId))
  const selectedEmployee = employees.find(e => e.id === parseInt(formData.employeeId))
  const selectedEmployeeName = selectedEmployee?.user?.name || 'نامشخص'

  const canGoToNextStep = () => {
    if (step === 1) {
      // Step 1: Service must be selected
      return !!(formData.serviceId)
    }
    if (step === 2) {
      // Step 2: Employee must be selected
      return !!(formData.employeeId && employees.length > 0)
    }
    if (step === 3) {
      // Step 3: Earliest mode allows Next (will fetch on click); manual requires date
      if (dateMode === 'earliest') return true
      return !!(formData.appointmentDate && formData.appointmentDate.trim().length > 0)
    }
    if (step === 4) {
      // Step 4: Time slot must be selected
      return !!(formData.appointmentTime && formData.appointmentTime.length > 0)
    }
    return false
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-2 border-white/20 shadow-2xl">
        {/* Glassmorphism Header */}
        <div className="relative bg-gradient-to-br from-teal/10 via-light-blue/10 to-main-orange/10 border-b border-white/20 backdrop-blur-md">
          <div className="absolute inset-0 bg-grid-white/5"></div>
          <DialogHeader className="relative p-6 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal to-light-blue flex items-center justify-center shadow-lg">
                <CalendarCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  رزرو نوبت جدید
                </DialogTitle>
                <DialogDescription className="text-sm mt-1">
            {step === 1 && 'انتخاب خدمت مورد نظر'}
            {step === 2 && 'انتخاب آرایشگر'}
            {step === 3 && 'انتخاب تاریخ نوبت'}
            {step === 4 && 'انتخاب ساعت مناسب'}
            {step === 5 && 'تایید نهایی'}
                </DialogDescription>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-2 mt-4">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    s <= step
                      ? 'bg-gradient-to-r from-teal to-light-blue shadow-lg shadow-teal/50'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Step 1: Service Selection ONLY */}
          {step === 1 && (
            <div className="space-y-4">
              <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal" />
                لیست خدمات - یک مورد انتخاب کنید
              </label>
              {services.length === 0 ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-4">در حال بارگذاری خدمات...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {services.map((service) => (
                    <Card
                      key={service.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        formData.serviceId === String(service.id)
                          ? 'ring-2 ring-teal shadow-lg shadow-teal/20 bg-teal/5'
                          : 'hover:ring-2 hover:ring-gray-300'
                      }`}
                      onClick={() => {
                        console.log('🎯 Service selected:', service.name)
                        setFormData({ ...formData, serviceId: String(service.id), employeeId: '' })
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{service.name}</h3>
                            <p className="text-sm text-muted-foreground mt-1">{service.description}</p>
                            <div className="flex gap-3 mt-2">
                              <Badge variant="outline" className="gap-1">
                                <Clock className="w-3 h-3" />
                                {service.durationMinutes} دقیقه
                              </Badge>
                              <Badge variant="outline" className="bg-gradient-to-r from-orange-50 to-red-50 text-red-600 border-red-200 font-semibold">
                                🎁 25% تخفیف
                              </Badge>
                            </div>
                          </div>
                          {formData.serviceId === String(service.id) && (
                            <CheckCircle className="w-6 h-6 text-teal flex-shrink-0 mr-2" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Employee Selection ONLY */}
          {step === 2 && (
            <div className="space-y-4">
              <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <User className="w-4 h-4 text-light-blue" />
                لیست آرایشگران - یک نفر انتخاب کنید
              </label>
              {loadingEmployees ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-light-blue mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-4">در حال بارگذاری آرایشگران...</p>
                </div>
              ) : employees.length === 0 ? (
                <div className="text-center py-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <p className="text-amber-700 dark:text-amber-300 font-medium">
                    متأسفانه آرایشگری برای این خدمت موجود نیست
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setStep(1)}
                  >
                    بازگشت به انتخاب خدمت
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                  {employees.map((employee, index) => (
                    <Card
                      key={employee.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                        formData.employeeId === String(employee.id)
                          ? 'ring-2 ring-light-blue shadow-lg shadow-light-blue/20 bg-light-blue/5'
                          : 'hover:ring-2 hover:ring-gray-300'
                      }`}
                      onClick={() => {
                        console.log('🎯 Employee selected:', employee.user?.name)
                        setFormData({ ...formData, employeeId: String(employee.id) })
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Avatar with badge */}
                            <div className="relative">
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md ${
                                employee.id === preferredEmployeeId
                                  ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                                  : 'bg-gradient-to-br from-light-blue to-teal'
                              }`}>
                                {employee.user?.name?.slice(0, 1) || '?'}
                              </div>
                              {employee.id === preferredEmployeeId && (
                                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg">
                                  <span className="text-xs font-bold text-white">💜</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Employee info */}
                            <div className="flex-1">
                              <h3 className="font-semibold text-base">{employee.user?.name || 'نام نامشخص'}</h3>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {employee.id === preferredEmployeeId && (
                                  <Badge className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                                    💜 آرایشگر من
                                  </Badge>
                                )}
                                {employee.specialty && (
                                  <Badge variant="outline" className="text-xs">
                                    {employee.specialty}
                                  </Badge>
                                )}
                                {index === 0 && employee.id !== preferredEmployeeId && (
                                  <Badge className="text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0">
                                    محبوب‌ترین
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Checkmark */}
                          {formData.employeeId === String(employee.id) && (
                            <CheckCircle className="w-6 h-6 text-light-blue flex-shrink-0" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Date — earliest vs manual */}
          {step === 3 && (
            <div className="space-y-4 overflow-visible">
              <label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <Calendar className="w-4 h-4 text-teal" />
                نحوه انتخاب زمان نوبت
              </label>
              <div className="space-y-3">
                <label className="flex flex-col gap-2 p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 has-[:checked]:border-teal has-[:checked]:bg-teal/5">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="dateMode"
                      value="earliest"
                      checked={dateMode === 'earliest'}
                      onChange={() => {
                        setDateMode('earliest')
                        fetchEarliestSlotPreview()
                      }}
                      className="w-4 h-4 text-teal"
                    />
                    <span className="font-medium">اولین نوبت ممکن</span>
                  </div>
                  {dateMode === 'earliest' && (
                    <div className="text-sm text-muted-foreground pr-7">
                      {loadingEarliestPreview && 'در حال بررسی نزدیک‌ترین زمان...'}
                      {!loadingEarliestPreview && earliestPreview && (
                        <>📅 {earliestPreview.jalaliDate} — 🕒 {earliestPreview.displayTime}</>
                      )}
                      {!loadingEarliestPreview && !earliestPreview && 'در حال حاضر نوبت آزادی وجود ندارد'}
                    </div>
                  )}
                </label>
                <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50 has-[:checked]:border-teal has-[:checked]:bg-teal/5">
                  <input
                    type="radio"
                    name="dateMode"
                    value="manual"
                    checked={dateMode === 'manual'}
                    onChange={() => setDateMode('manual')}
                    className="w-4 h-4 text-teal"
                  />
                  <span className="font-medium">انتخاب تاریخ دلخواه</span>
                </label>
              </div>
              {dateMode === 'manual' && (
                <>
                  <PersianDatePicker
                    value={formData.appointmentDate}
                    onChange={(date) => setFormData({ ...formData, appointmentDate: date })}
                    label="تاریخ نوبت را انتخاب کنید"
                    placeholder="انتخاب تاریخ"
                    minDate={getCurrentJalaliDate()}
                    disablePortal={false}
                  />
                  {formData.appointmentDate && (
                    <div className="flex items-center justify-between gap-3 pt-2">
                      <span className="text-sm text-muted-foreground">
                        {englishToPersianDigits(formData.appointmentDate)} ({getJalaliWeekdayName(formData.appointmentDate)})
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!formData.appointmentDate || isJalaliDateBefore(addDaysToJalali(formData.appointmentDate, -1), getCurrentJalaliDate())}
                          onClick={() => setFormData({ ...formData, appointmentDate: addDaysToJalali(formData.appointmentDate, -1) })}
                        >
                          روز قبل
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setFormData({ ...formData, appointmentDate: addDaysToJalali(formData.appointmentDate, 1) })}
                        >
                          روز بعد
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 4: Time */}
          {step === 4 && (
            <div className="space-y-4">
              <label className="text-sm font-medium block flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal" />
                ساعت مناسب را انتخاب کنید
              </label>
              {loadingSlots ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-4">در حال بارگذاری...</p>
                </div>
              ) : timeSlots.length === 0 ? (
                <div className="text-center py-8 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <p className="text-amber-700 dark:text-amber-300">
                    متأسفانه در این تاریخ زمان خالی موجود نیست
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setStep(2)}
                  >
                    انتخاب تاریخ دیگر
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Available Slots (slots &lt; now+2h disabled when date is today; backend enforces) */}
                  {timeSlots.filter(s => s.available !== false).length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2 flex items-center">
                        <div className="w-2 h-2 rounded-full bg-green-500 ml-2"></div>
                        زمان‌های خالی ({timeSlots.filter(s => {
                          const tooEarly = formData.appointmentDate === getCurrentJalaliDate() && new Date(s.time) < new Date(Date.now() + 2 * 60 * 60 * 1000)
                          return s.available !== false && !tooEarly
                        }).length} ساعت)
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {timeSlots
                          .filter(s => {
                            const tooEarly = formData.appointmentDate === getCurrentJalaliDate() && new Date(s.time) < new Date(Date.now() + 2 * 60 * 60 * 1000)
                            return s.available !== false && !tooEarly
                          })
                          .map((slot) => (
                            <Card
                              key={slot.time}
                              className={`transition-all duration-200 ${
                                formData.appointmentTime === slot.time
                                  ? 'ring-2 ring-green-600 shadow-lg shadow-green-500/20 bg-green-50 dark:bg-green-950/20 cursor-pointer hover:shadow-md'
                                  : 'cursor-pointer hover:shadow-md hover:ring-2 hover:ring-green-300 border-green-200'
                              }`}
                              onClick={() => setFormData({ ...formData, appointmentTime: slot.time })}
                            >
                              <CardContent className="p-3 text-center">
                                <Clock className={`w-5 h-5 mx-auto mb-1 ${formData.appointmentTime === slot.time ? 'text-green-600' : 'text-gray-600'}`} />
                                <p className={`font-medium ${formData.appointmentTime === slot.time ? 'text-green-700' : 'text-gray-700'}`}>{slot.displayTime}</p>
                                {formData.appointmentTime === slot.time && (
                                  <CheckCircle className="w-4 h-4 text-green-600 mx-auto mt-1" />
                                )}
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Busy Slots — only truly booked; exclude min_2h (too-early) */}
                  {timeSlots.filter(s => s.available === false && s.reason !== 'min_2h').length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2 flex items-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 ml-2"></div>
                        ساعت‌های رزرو شده ({timeSlots.filter(s => s.available === false && s.reason !== 'min_2h').length} ساعت)
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {timeSlots.filter(s => s.available === false && s.reason !== 'min_2h').map((slot) => (
                          <Card
                            key={slot.time}
                            className="cursor-not-allowed opacity-60 bg-red-50 dark:bg-red-950/20 border-red-200"
                          >
                            <CardContent className="p-3 text-center">
                              <Clock className="w-5 h-5 mx-auto mb-1 text-red-600" />
                              <p className="font-medium text-red-600">{slot.displayTime}</p>
                              <p className="text-xs text-red-500 mt-1">رزرو شده</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Confirmation */}
          {step === 5 && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-teal/10 to-light-blue/10 rounded-2xl p-6 border-2 border-white/20 shadow-inner">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-teal" />
                  اطلاعات نوبت شما
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-muted-foreground">خدمت:</span>
                    <span className="font-medium">{selectedService?.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-muted-foreground">آرایشگر:</span>
                    <span className="font-medium">{selectedEmployeeName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-muted-foreground">تاریخ:</span>
                    <span className="font-medium">{formData.appointmentDate}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-muted-foreground">ساعت:</span>
                    <span className="font-medium">
                      {earliestDisplayTime ?? timeSlots.find(s => s.time === formData.appointmentTime)?.displayTime ?? formData.appointmentTime}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">تخفیف ویژه:</span>
                    <span className="font-bold text-red-600 flex items-center gap-2">
                      🎁 25% تخفیف
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">یادداشت (اختیاری)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="توضیحات یا درخواست خاص..."
                  className="w-full p-3 border rounded-lg min-h-[80px] resize-none"
                  dir="rtl"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/20 bg-gray-50/80 dark:bg-gray-800/80 backdrop-blur-sm p-4 flex justify-between">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              disabled={loading}
              className="gap-2"
            >
              <ArrowRight className="w-4 h-4" />
              مرحله قبل
            </Button>
          )}
          {step < 5 ? (
            <Button
              onClick={async () => {
                if (step === 3 && dateMode === 'earliest') {
                  const ok = await fetchEarliestSlot()
                  if (ok) setStep(5)
                } else {
                  setStep(step + 1)
                }
              }}
              disabled={!canGoToNextStep() || loading || loadingEarliest}
              className="mr-auto bg-gradient-to-r from-teal to-light-blue hover:from-teal/90 hover:to-light-blue/90 gap-2 shadow-lg"
            >
              {step === 3 && dateMode === 'earliest' && loadingEarliest ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  در حال پیدا کردن نوبت...
                </>
              ) : (
                <>
                  مرحله بعد
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="mr-auto bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 gap-2 shadow-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  در حال ثبت...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  تأیید و ثبت نوبت
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

