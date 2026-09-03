"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { Label } from "@/components/ui/label"
import { AppLogo } from "@/components/common/AppLogo"
import axios from "@/lib/axios"
import Footer from "@/components/Footer"
import PersianDatePicker from "@/components/ui/PersianDatePicker"
import { parseFromJalali, isValidJalaliDate } from "@/lib/date"

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    birthdate: '',
    notes: '',
    preferredEmployeeId: '' as any,
  })
  const [employees, setEmployees] = useState<{ id: number; name: string; isDefault: boolean }[]>([])

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        console.log('🔍 Fetching employees from /api/employees/public/active...')
        const res = await fetch('/api/employees/public/active')
        console.log('📡 Response status:', res.status)
        
        if (!res.ok) {
          console.error('❌ Response not OK:', res.status, res.statusText)
          setEmployees([])
          return
        }
        
        const data = await res.json()
        console.log('✅ Employees fetched:', data)
        
        const employeeList = Array.isArray(data) ? data : []
        console.log('📋 Employee list:', employeeList)
        
        setEmployees(employeeList)
        
        // Set default employee (first one, which is "تیم دوکارد")
        if (employeeList.length > 0) {
          const defaultEmployee = employeeList.find(emp => emp.isDefault) || employeeList[0]
          console.log('⭐ Setting default employee:', defaultEmployee)
          
          setFormData(prev => ({
            ...prev,
            preferredEmployeeId: defaultEmployee.id
          }))
        } else {
          console.warn('⚠️ No employees found in list')
        }
      } catch (e) {
        console.error('❌ Employees fetch error:', e)
        setEmployees([])
      }
    }
    fetchEmployees()
  }, [])

  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'نام الزامی است'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'نام باید حداقل 2 کاراکتر باشد'
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'شماره موبایل الزامی است'
    } else if (!/^09\d{9}$/.test(formData.phone.trim())) {
      newErrors.phone = 'شماره موبایل باید با 09 شروع شود و 11 رقم باشد'
    }
    
    // ایمیل اختیاری است، اما اگر وارد شده باشد باید معتبر باشد
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'ایمیل معتبر نیست'
    }
    
    // تاریخ تولد اختیاری است، اما اگر وارد شده باشد باید معتبر باشد
    if (formData.birthdate) {
      if (!isValidJalaliDate(formData.birthdate)) {
        newErrors.birthdate = 'تاریخ تولد معتبر نیست'
      } else {
        const parsedDate = parseFromJalali(formData.birthdate)
        if (parsedDate && parsedDate > new Date()) {
          newErrors.birthdate = 'تاریخ تولد نمی‌تواند در آینده باشد'
        }
      }
    }
    
    if (!formData.password) {
      newErrors.password = 'رمز عبور الزامی است'
    } else if (formData.password.length < 6) {
      newErrors.password = 'رمز عبور باید حداقل 6 کاراکتر باشد'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    setLoading(true)
    try {
      // ارسال با role پیش‌فرض CUSTOMER
      const payload: any = { ...formData, role: 'CUSTOMER' }
      
      // Convert Jalali birthdate to Gregorian ISO string
      if (payload.birthdate) {
        const gregorianDate = parseFromJalali(payload.birthdate)
        payload.birthdate = gregorianDate ? gregorianDate.toISOString().split('T')[0] : ''
      }
      
      if (payload.preferredEmployeeId === '' || payload.preferredEmployeeId === undefined) {
        delete payload.preferredEmployeeId
      } else {
        payload.preferredEmployeeId = Number(payload.preferredEmployeeId)
      }
      await axios.post("/auth/register", payload)
      toast({
        title: 'ثبت‌نام موفق',
        description: 'ثبت‌نام با موفقیت انجام شد! لطفاً با شماره موبایل یا ایمیل و رمز عبور خود وارد شوید.'
      })
      router.push('/login')
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      
      let description = 'ثبت‌نام با خطا مواجه شد. لطفاً دوباره تلاش کنید.';
      let fieldError: string | null = null;
      
      // Handle network errors
      if (!error.response) {
        description = 'خطا در ارتباط با سرور. لطفاً اتصال اینترنت خود را بررسی کنید.';
      } 
      // Handle specific error codes
      else {
        const status = error.response.status;
        const message = error.response.data?.message || '';
        
        if (status === 409) {
          // Conflict - duplicate phone or email
          description = message || 'کاربر با این شماره تلفن یا ایمیل قبلاً ثبت‌نام کرده است.';
          
          // Determine which field is duplicate
          if (message.includes('شماره') || message.includes('تلفن') || message.includes('phone')) {
            fieldError = 'phone';
            setErrors({ phone: 'این شماره موبایل قبلاً ثبت شده است' });
          } else if (message.includes('ایمیل') || message.includes('email')) {
            fieldError = 'email';
            setErrors({ email: 'این ایمیل قبلاً ثبت شده است' });
          }
          
          // Add helpful message
          description += '\n\nاگر قبلاً ثبت‌نام کرده‌اید، می‌توانید وارد شوید.';
        } else if (status === 400) {
          description = message || 'اطلاعات وارد شده نامعتبر است. لطفاً فرم را بررسی کنید.';
        } else if (status === 500) {
          description = 'خطای سرور. لطفاً بعداً دوباره تلاش کنید.';
        } else {
          description = message || description;
        }
      }
      
      toast({
        variant: 'destructive',
        title: 'خطا در ثبت‌نام',
        description
      });
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value })
    // حذف خطا هنگام تایپ
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl animate-fade-in-up bg-white/90 dark:bg-card/80 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2 pt-6">
              <AppLogo size="md" centered animated />
            </div>
            <CardTitle className="text-3xl">ایجاد حساب کاربری</CardTitle>
            <p className="text-sm text-muted-foreground mt-3">
              برای استفاده از سیستم مدیریت آرایشگاه ثبت‌نام کنید
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preferredEmployeeId" className="label-doocard">انتخاب آرایشگر</Label>
              <select
                id="preferredEmployeeId"
                value={formData.preferredEmployeeId}
                onChange={e => handleInputChange('preferredEmployeeId', e.target.value)}
                className="input-doocard w-full h-12"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}{emp.isDefault ? ' (پیش‌فرض)' : ''}
                  </option>
                ))}
                {employees.length === 0 && (
                  <option value="" disabled>در حال بارگذاری...</option>
                )}
              </select>
              {employees.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">در حال بارگذاری لیست آرایشگران...</p>
              )}
              {employees.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  آرایشگر پیش‌فرض: {employees.find(e => e.isDefault)?.name || 'تیم دوکارد'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="label-doocard">نام و نام خانوادگی *</Label>
              <Input
                id="name"
                placeholder="نام و نام خانوادگی"
                value={formData.name}
                onChange={e => handleInputChange('name', e.target.value)}
                className={errors.name ? 'input-doocard-error' : 'input-doocard'}
                required
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">شماره موبایل *</Label>
              <Input
                id="phone"
                placeholder="09123456789"
                value={formData.phone}
                onChange={e => handleInputChange('phone', e.target.value)}
                className={errors.phone ? 'border-red-500' : ''}
                required
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">ایمیل (اختیاری)</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@email.com (اختیاری)"
                value={formData.email}
                onChange={e => handleInputChange('email', e.target.value)}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email}</p>
              )}
              <p className="text-xs text-muted-foreground">
                می‌توانید با شماره موبایل یا ایمیل وارد شوید
              </p>
            </div>
            
            <div className="space-y-2">
              <PersianDatePicker
                value={formData.birthdate}
                onChange={(date) => handleInputChange('birthdate', date)}
                label="تاریخ تولد (اختیاری)"
                placeholder="مثال: ۱۳۷۰/۰۱/۰۱"
                error={errors.birthdate}
                maxDate={new Date().toISOString().split('T')[0]}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">رمز عبور *</Label>
              <Input
                id="password"
                type="password"
                placeholder="حداقل 6 کاراکتر"
                value={formData.password}
                onChange={e => handleInputChange('password', e.target.value)}
                className={errors.password ? 'border-red-500' : ''}
                required
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password}</p>
              )}
            </div>
            
            <Button 
              type="submit" 
              className="w-full btn-doocard btn-doocard-lg mt-6" 
              disabled={loading}
              style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
            >
              {loading ? (
                <div className="flex items-center gap-2" style={{ color: '#111827', WebkitTextFillColor: '#111827' }}>
                  <div className="spinner-doocard !w-5 !h-5 !border-2"></div>
                  در حال ثبت‌نام...
                </div>
              ) : (
                <span style={{ color: '#111827', WebkitTextFillColor: '#111827' }}>ثبت‌نام</span>
              )}
            </Button>
          </form>
          
          <div className="divider-doocard"></div>
          
          <div className="text-center">
            <span className="text-sm text-muted-foreground">قبلاً ثبت‌نام کرده‌اید؟ </span>
            <button
              type="button"
              className="text-sm font-semibold text-foreground hover:opacity-80 transition-colors duration-300"
              onClick={() => router.push('/login')}
            >
              ورود به سیستم
            </button>
          </div>
        </CardContent>
      </Card>
      </div>
      <Footer />
    </div>
  )
} 