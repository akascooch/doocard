"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { 
  User, 
  Phone, 
  Mail, 
  Bell, 
  Shield, 
  LogOut,
  Save,
  Eye,
  EyeOff
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { getCurrentUser } from '@/lib/auth'
import axios from '@/lib/axios'

export default function CustomerSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [notifications, setNotifications] = useState({
    appointmentReminders: true,
    promotionalMessages: false,
    systemUpdates: true
  })

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      setFormData({
        name: currentUser.name || '',
        phone: currentUser.phone || '',
        email: currentUser.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    }
  }, [])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveProfile = async () => {
    setLoading(true)
    try {
      // Update user profile
      await axios.put('/users/profile', {
        name: formData.name,
        phone: formData.phone,
        email: formData.email
      })

      toast({
        title: 'موفقیت',
        description: 'اطلاعات پروفایل با موفقیت به‌روزرسانی شد',
      })
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در به‌روزرسانی پروفایل',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: 'خطا',
        description: 'رمز عبور جدید و تأیید آن مطابقت ندارند',
        variant: 'destructive'
      })
      return
    }

    if (formData.newPassword.length < 6) {
      toast({
        title: 'خطا',
        description: 'رمز عبور باید حداقل ۶ کاراکتر باشد',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      if (!user || !user.id) {
        throw new Error('User not found')
      }

      await axios.patch(`/users/${user.id}/password`, {
        password: formData.newPassword
      })

      toast({
        title: 'موفقیت',
        description: 'رمز عبور با موفقیت تغییر کرد',
      })

      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      }))
    } catch (error: any) {
      console.error('Error changing password:', error)
      toast({
        title: 'خطا',
        description: error.response?.data?.message || 'خطا در تغییر رمز عبور',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">تنظیمات</h1>
        <p className="text-muted-foreground">
          مدیریت اطلاعات شخصی و تنظیمات حساب کاربری
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              اطلاعات پروفایل
            </CardTitle>
            <CardDescription>
              اطلاعات شخصی و تماس خود را به‌روزرسانی کنید
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">نام و نام خانوادگی</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone">شماره تلفن</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="email">ایمیل</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveProfile} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                ذخیره تغییرات
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              تغییر رمز عبور
            </CardTitle>
            <CardDescription>
              برای امنیت بیشتر، رمز عبور خود را به‌روزرسانی کنید
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="currentPassword">رمز عبور فعلی</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.currentPassword}
                  onChange={(e) => handleInputChange('currentPassword', e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="newPassword">رمز عبور جدید</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) => handleInputChange('newPassword', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">تأیید رمز عبور جدید</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleChangePassword} disabled={loading}>
                <Shield className="h-4 w-4 mr-2" />
                تغییر رمز عبور
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              تنظیمات اعلان‌ها
            </CardTitle>
            <CardDescription>
              انتخاب کنید که چه نوع اعلان‌هایی دریافت کنید
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>یادآوری نوبت‌ها</Label>
                <p className="text-sm text-muted-foreground">
                  دریافت یادآوری برای نوبت‌های آینده
                </p>
              </div>
              <Switch
                checked={notifications.appointmentReminders}
                onCheckedChange={(value) => handleNotificationChange('appointmentReminders', value)}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label>پیام‌های تبلیغاتی</Label>
                <p className="text-sm text-muted-foreground">
                  دریافت پیشنهادات و تخفیف‌های ویژه
                </p>
              </div>
              <Switch
                checked={notifications.promotionalMessages}
                onCheckedChange={(value) => handleNotificationChange('promotionalMessages', value)}
              />
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <div>
                <Label>به‌روزرسانی‌های سیستم</Label>
                <p className="text-sm text-muted-foreground">
                  اطلاع از تغییرات و به‌روزرسانی‌های سیستم
                </p>
              </div>
              <Switch
                checked={notifications.systemUpdates}
                onCheckedChange={(value) => handleNotificationChange('systemUpdates', value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card>
          <CardHeader>
            <CardTitle>عملیات حساب کاربری</CardTitle>
            <CardDescription>
              مدیریت حساب کاربری و خروج از سیستم
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleLogout} className="text-red-600 border-red-600 hover:bg-red-50">
                <LogOut className="h-4 w-4 mr-2" />
                خروج از حساب کاربری
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
