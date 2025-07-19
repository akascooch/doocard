"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import axios from "@/lib/axios"

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    password: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // ارسال با role پیش‌فرض CUSTOMER
      await axios.post("/users", { ...formData, role: 'CUSTOMER' })
      toast({
        title: 'ثبت‌نام موفق',
        description: 'ثبت‌نام با موفقیت انجام شد!'
      })
        router.push('/dashboard/customers')
    } catch (error: any) {
      let description = error?.response?.data?.message || 'ثبت‌نام با خطا مواجه شد';
      if (description.includes('ایمیل قبلاً ثبت شده است')) {
        description = 'این ایمیل قبلاً ثبت شده است.';
      }
      toast({
        variant: 'destructive',
        title: 'خطا در ثبت‌نام',
        description
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>ثبت‌نام</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="نام"
              value={formData.firstName}
              onChange={e => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              placeholder="نام خانوادگی"
              value={formData.lastName}
              onChange={e => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
            <Input
              placeholder="شماره موبایل"
              value={formData.phoneNumber}
              onChange={e => setFormData({ ...formData, phoneNumber: e.target.value })}
              required
            />
            <Input
              type="email"
              placeholder="ایمیل"
              value={formData.email}
              onChange={e => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <Input
              type="password"
              placeholder="رمز عبور"
              value={formData.password}
              onChange={e => setFormData({ ...formData, password: e.target.value })}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'در حال ثبت‌نام...' : 'ثبت‌نام'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 