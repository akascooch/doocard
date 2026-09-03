"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Save, RefreshCw, Home, Users, Package, GraduationCap, MessageSquare, Phone } from 'lucide-react'

interface HomepageDetails {
  id?: number
  about?: string
  team?: string
  products?: string
  trainings?: string
  testimonials?: string
  contact?: string
  createdAt?: string
  updatedAt?: string
}

export default function AdminHomepagePage() {
  const [homepageDetails, setHomepageDetails] = useState<HomepageDetails>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchHomepageDetails()
  }, [])

  const fetchHomepageDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/homepage')
      if (response.ok) {
        const data = await response.json()
        setHomepageDetails(data)
      } else {
        throw new Error('Failed to fetch homepage details')
      }
    } catch (error) {
      console.error('Error fetching homepage details:', error)
      toast({
        title: 'خطا',
        description: 'خطا در بارگذاری اطلاعات صفحه اصلی',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const token = localStorage.getItem('token')
      
      const response = await fetch('/api/homepage', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(homepageDetails),
      })

      if (response.ok) {
        toast({
          title: 'موفقیت',
          description: 'اطلاعات صفحه اصلی با موفقیت به‌روزرسانی شد',
        })
      } else {
        throw new Error('Failed to update homepage details')
      }
    } catch (error) {
      console.error('Error updating homepage details:', error)
      toast({
        title: 'خطا',
        description: 'خطا در به‌روزرسانی اطلاعات صفحه اصلی',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof HomepageDetails, value: string) => {
    setHomepageDetails(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">در حال بارگذاری...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">مدیریت صفحه اصلی</h1>
          <p className="text-muted-foreground">
            مدیریت محتوای صفحه اصلی وب‌سایت
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={fetchHomepageDetails}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 ml-2" />
            بازخوانی
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            <Save className="h-4 w-4 ml-2" />
            {saving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* About Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              درباره ما
            </CardTitle>
            <CardDescription>
              متن معرفی سالن زیبایی و خدمات ارائه شده
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="about">متن درباره ما</Label>
              <Textarea
                id="about"
                placeholder="درباره سالن زیبایی و خدمات ارائه شده بنویسید..."
                value={homepageDetails.about || ''}
                onChange={(e) => handleInputChange('about', e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Team Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              تیم ما
            </CardTitle>
            <CardDescription>
              معرفی تیم و کارکنان سالن زیبایی
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="team">متن معرفی تیم</Label>
              <Textarea
                id="team"
                placeholder="درباره تیم و کارکنان سالن زیبایی بنویسید..."
                value={homepageDetails.team || ''}
                onChange={(e) => handleInputChange('team', e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Products Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              محصولات و خدمات
            </CardTitle>
            <CardDescription>
              معرفی محصولات و خدمات ارائه شده
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="products">متن محصولات و خدمات</Label>
              <Textarea
                id="products"
                placeholder="درباره محصولات و خدمات ارائه شده بنویسید..."
                value={homepageDetails.products || ''}
                onChange={(e) => handleInputChange('products', e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Trainings Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              دوره‌های آموزشی
            </CardTitle>
            <CardDescription>
              معرفی دوره‌های آموزشی و تخصصی
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="trainings">متن دوره‌های آموزشی</Label>
              <Textarea
                id="trainings"
                placeholder="درباره دوره‌های آموزشی و تخصصی بنویسید..."
                value={homepageDetails.trainings || ''}
                onChange={(e) => handleInputChange('trainings', e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Testimonials Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              نظرات مشتریان
            </CardTitle>
            <CardDescription>
              نظرات و تجربیات مشتریان از خدمات
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="testimonials">متن نظرات مشتریان</Label>
              <Textarea
                id="testimonials"
                placeholder="درباره نظرات و تجربیات مشتریان بنویسید..."
                value={homepageDetails.testimonials || ''}
                onChange={(e) => handleInputChange('testimonials', e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-primary" />
              اطلاعات تماس
            </CardTitle>
            <CardDescription>
              اطلاعات تماس و آدرس سالن زیبایی
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="contact">متن اطلاعات تماس</Label>
              <Textarea
                id="contact"
                placeholder="اطلاعات تماس، آدرس و ساعات کاری بنویسید..."
                value={homepageDetails.contact || ''}
                onChange={(e) => handleInputChange('contact', e.target.value)}
                rows={4}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Save Button at Bottom */}
      <div className="flex justify-end pt-6 border-t">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
        >
          <Save className="h-4 w-4 ml-2" />
          {saving ? 'در حال ذخیره...' : 'ذخیره تمام تغییرات'}
        </Button>
      </div>
    </div>
  )
}