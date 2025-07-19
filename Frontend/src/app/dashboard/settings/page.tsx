"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import axios from "@/lib/axios"

function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border p-6 rounded-xl"
    >
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <Icon name={icon} size={20} />
        {title}
      </h2>
      {children}
    </motion.div>
  )
}

export default function SettingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [salonName, setSalonName] = useState("")
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
  const [theme, setTheme] = useState("dark")
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Load saved settings
    const savedSalonName = localStorage.getItem('salonName')
    if (savedSalonName) {
      setSalonName(savedSalonName)
    }

    // Load logo
    fetchLogo()
  }, [])

  const fetchLogo = async () => {
    try {
      const response = await axios.get('/settings/logo')
      setLogoUrl(response.data.path)
    } catch (error) {
      console.error('Error fetching logo:', error)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append('logo', file)

    try {
      setIsLoading(true)
      const response = await axios.post('/settings/upload-logo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })
      
      setLogoUrl(response.data.path)
      toast({
        title: "لوگو آپلود شد",
        description: "لوگوی جدید با موفقیت ذخیره شد",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطا در آپلود",
        description: error.response?.data?.message || "مشکلی در آپلود لوگو پیش آمده است",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveSettings = () => {
    setIsLoading(true)
    try {
      // Save settings to localStorage
      localStorage.setItem('salonName', salonName)
      
      // Show success toast
      toast({
        title: "تنظیمات ذخیره شد",
        description: "تغییرات با موفقیت اعمال شد",
      })

      // Dispatch custom event for sidebar update
      window.dispatchEvent(new CustomEvent('salonNameUpdated', { detail: salonName }))
    } catch (error) {
      toast({
        title: "خطا در ذخیره تنظیمات",
        description: "لطفا دوباره تلاش کنید",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetDatabase = async () => {
    setShowResetDialog(false);
    setIsResetting(true);
    try {
      const response = await axios.post('/settings/reset-database');
      
      toast({
        title: "ریست کامل انجام شد",
        description: "تمام داده‌ها پاک شدند و سیستم ریست شد",
      });

      // پاک کردن توکن و ریدایرکت به لاگین
      localStorage.removeItem('user');
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      setTimeout(() => {
        router.push('/login');
      }, 2000);

    } catch (error: any) {
      console.error('Error resetting database:', error);
      toast({
        variant: "destructive",
        title: "خطا در ریست کردن",
        description: error.response?.data?.message || "مشکلی در ریست کردن پیش آمده است",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">تنظیمات</h1>
        <Button onClick={handleSaveSettings} disabled={isLoading}>
          {isLoading ? (
            <>
              <Icon name="Loader" size={16} className="ml-2 animate-spin" />
              در حال ذخیره...
            </>
          ) : (
            <>
              <Icon name="Save" size={16} className="ml-2" />
              ذخیره تغییرات
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* تنظیمات پایه */}
        <SettingsSection title="تنظیمات پایه" icon="Shield">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">نام آرایشگاه</label>
              <input
                type="text"
                value={salonName}
                onChange={(e) => setSalonName(e.target.value)}
                placeholder="نام آرایشگاه خود را وارد کنید"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                این نام در بالای سایدبار نمایش داده خواهد شد
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">لوگو</label>
              <div className="flex items-center gap-4">
                <div className="w-24 h-24 rounded-lg border border-border overflow-hidden">
                  {logoUrl ? (
                    <img
                      src={`http://localhost:3001${logoUrl}`}
                      alt="لوگوی آرایشگاه"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                      {salonName ? salonName.charAt(0) : "B"}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Icon name="Loader" size={16} className="ml-2 animate-spin" />
                        در حال آپلود...
                      </>
                    ) : (
                      <>
                        <Icon name="Upload" size={16} className="ml-2" />
                        آپلود لوگو
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    فرمت‌های مجاز: JPG، PNG، GIF - حداکثر سایز: 2MB
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* تنظیمات اعلان‌ها */}
        <SettingsSection title="اعلان‌ها" icon="Bell">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">اعلان‌های پیامکی</h3>
                <p className="text-sm text-muted-foreground">
                  ارسال پیامک یادآوری نوبت
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">اعلان‌های ایمیلی</h3>
                <p className="text-sm text-muted-foreground">
                  ارسال ایمیل گزارش روزانه
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </SettingsSection>

        {/* تنظیمات پشتیبان‌گیری */}
        <SettingsSection title="پشتیبان‌گیری" icon="Database">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">پشتیبان‌گیری خودکار</h3>
                <p className="text-sm text-muted-foreground">
                  پشتیبان‌گیری روزانه از اطلاعات
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <Button variant="outline" className="w-full">
              <Icon name="Upload" size={16} className="ml-2" />
              پشتیبان‌گیری دستی
            </Button>
          </div>
        </SettingsSection>

        {/* تنظیمات ظاهری */}
        <SettingsSection title="ظاهر" icon="Palette">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">تم</label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="light">روشن</option>
                <option value="dark">تاریک</option>
                <option value="system">سیستم</option>
              </select>
            </div>
          </div>
        </SettingsSection>

        {/* تنظیمات سیستم */}
        <SettingsSection title="سیستم" icon="Settings">
          <div className="space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <h3 className="font-medium text-destructive mb-2">ریست کامل سیستم</h3>
              <p className="text-sm text-muted-foreground mb-4">
                این عملیات تمام داده‌ها را پاک کرده و سیستم را به حالت اولیه برمی‌گرداند.
                <br />
                <strong className="text-destructive">این عملیات غیرقابل بازگشت است!</strong>
              </p>
              <Button 
                onClick={() => setShowResetDialog(true)}
                disabled={isResetting}
                className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isResetting ? (
                  <>
                    <Icon name="Loader" size={16} className="ml-2 animate-spin" />
                    در حال ریست کردن...
                  </>
                ) : (
                  <>
                    <Icon name="Trash2" size={16} className="ml-2" />
                    ریست کامل سیستم
                  </>
                )}
              </Button>
            </div>
          </div>
        </SettingsSection>
      </div>

      {/* Dialog تأیید ریست */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>⚠️ ریست کامل سیستم</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید تمام داده‌ها را پاک کنید؟
              <br />
              <br />
              <strong className="text-destructive">این عملیات غیرقابل بازگشت است و تمام اطلاعات پاک خواهند شد!</strong>
              <br />
              <br />
              • تمام مشتریان
              <br />
              • تمام نوبت‌ها
              <br />
              • تمام تراکنش‌ها
              <br />
              • تمام تنظیمات
              <br />
              • تمام کاربران (به جز ادمین جدید)
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
              disabled={isResetting}
            >
              لغو
            </Button>
            <Button
              onClick={handleResetDatabase}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? (
                <>
                  <Icon name="Loader" size={16} className="ml-2 animate-spin" />
                  در حال ریست کردن...
                </>
              ) : (
                <>
                  <Icon name="Trash2" size={16} className="ml-2" />
                  ریست کامل
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 