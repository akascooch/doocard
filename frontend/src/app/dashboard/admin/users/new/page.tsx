"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import axios from "@/lib/axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft, Plus, User } from "lucide-react"
import { ADMIN_USER_ROLE_OPTIONS } from "@/lib/user-roles"

export default function CreateUserPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    role: "CUSTOMER",
    password: "",
    salaryPercentage: 60,
  })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleRoleChange = (value: string) => {
    setFormData({ ...formData, role: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      await axios.post("/api/users", formData)
      
      toast({
        title: "موفقیت",
        description: "کاربر جدید با موفقیت ایجاد شد"
      })
      
      router.push("/dashboard/admin/users")
    } catch (err: any) {
      toast({
        title: "خطا",
        description: err?.response?.data?.message || "خطا در ایجاد کاربر",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
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
                <Plus className="h-5 w-5" />
                ایجاد کاربر جدید
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                کاربر جدید را در سیستم ثبت کنید
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
                <Select onValueChange={handleRoleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="نقش کاربر را انتخاب کنید" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_USER_ROLE_OPTIONS.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">رمز عبور</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
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
                <User className="h-4 w-4 ml-2" />
                {loading ? "در حال ایجاد..." : "ایجاد کاربر"}
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