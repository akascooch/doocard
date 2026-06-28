"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import axios from "@/lib/axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Save, User } from "lucide-react"
import { ADMIN_USER_ROLE_OPTIONS } from "@/lib/user-roles"

export default function EditUserPage() {
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    role: "CUSTOMER",
    password: "", // فیلد جدید برای رمز عبور
    salaryPercentage: 60,
  })
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await axios.get(`/users/${id}`)
        setFormData({
          ...response.data,
          password: "", // رمز عبور را خالی نگه می‌داریم
          salaryPercentage: response.data.salaryPercentage || 60 // مقدار پیش‌فرض
        })
      } catch (error) {
        console.error('Error fetching user:', error);
        toast({
          title: "خطا",
          description: "خطا در بارگذاری اطلاعات کاربر",
          variant: "destructive"
        })
      } finally {
        setInitialLoading(false)
      }
    }
    fetchUser()
  }, [id, toast])

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleRoleChange = (value: string) => {
    setFormData({ ...formData, role: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🔧 Form submitted, preventing default');
    console.log('🔧 Form data before submission:', formData);
    
    // بررسی validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phoneNumber || !formData.role) {
      console.log('❌ Validation failed:', {
        firstName: !!formData.firstName,
        lastName: !!formData.lastName,
        email: !!formData.email,
        phoneNumber: !!formData.phoneNumber,
        role: !!formData.role
      });
      toast({
        title: "خطا",
        description: "لطفاً تمام فیلدهای اجباری را پر کنید",
        variant: "destructive"
      });
      return;
    }
    
    setLoading(true)
    
    try {
      console.log('🔧 Submitting form data:', formData);
      
      // اگر رمز عبور وارد شده، آن را ارسال کن
      const updateData: any = { ...formData }
      if (!updateData.password) {
        updateData.password = undefined
      }
      
      // تبدیل salaryPercentage به عدد
      if (updateData.salaryPercentage) {
        updateData.salaryPercentage = Number(updateData.salaryPercentage)
      }
      
      console.log('📝 Final update data:', updateData);
      
      const response = await axios.patch(`/users/${id}`, updateData)
      console.log('✅ Update response:', response.data);
      
      toast({
        title: "موفقیت",
        description: "اطلاعات کاربر با موفقیت بروزرسانی شد"
      })
      
      router.push("/dashboard/admin/users")
    } catch (err: any) {
      console.error('❌ Update error:', err);
      console.error('Error response:', err.response?.data);
      toast({
        title: "خطا",
        description: err?.response?.data?.message || "خطا در ویرایش کاربر",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>در حال بارگذاری...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/dashboard/admin/users")}
            >
              <ArrowLeft className="h-4 w-4 ml-2" />
              بازگشت
            </Button>
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                ویرایش کاربر
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                اطلاعات کاربر را ویرایش کنید
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">نام</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lastName">نام خانوادگی</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">ایمیل</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">شماره موبایل</Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">نقش</Label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ADMIN_USER_ROLE_OPTIONS.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور جدید (اختیاری)</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="برای تغییر رمز عبور وارد کنید"
                />
              </div>
            </div>
            
      {formData.role === "EMPLOYEE" && (
              <div className="space-y-2">
                <Label htmlFor="salaryPercentage">درصد حقوق</Label>
                <Input
                  id="salaryPercentage"
          name="salaryPercentage" 
          type="number" 
          min="1" 
          max="100" 
          value={formData.salaryPercentage} 
          onChange={handleChange} 
          placeholder="درصد حقوق (پیش‌فرض: 60)" 
                />
              </div>
            )}
            
            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="flex-1"
              >
                <Save className="h-4 w-4 ml-2" />
                {loading ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard/admin/users")}
              >
                انصراف
              </Button>
      </div>
    </form>
        </CardContent>
      </Card>
    </div>
  )
}