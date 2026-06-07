"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import axios from "../../../lib/axios"

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
  const [mounted, setMounted] = useState(false)
  const [salonName, setSalonName] = useState("")
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true)
  const [theme, setTheme] = useState("dark")
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)


  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return; // Don't run until mounted
    
    // Load saved settings
    const win = globalThis as any;
    if (win.window) {
      const savedSalonName = win.window.localStorage.getItem('salonName')
      if (savedSalonName) {
        setSalonName(savedSalonName)
      }
    }
  }, [mounted])



  const handleSaveSettings = () => {
    setIsLoading(true)
    try {
      // Save settings to localStorage
      const win = globalThis as any;
      if (win.window) {
        win.window.localStorage.setItem('salonName', salonName)
      }
      
      // Show success toast
      toast({
        title: "تنظیمات ذخیره شد",
        description: "تغییرات با موفقیت اعمال شد",
      })

      // Dispatch custom event for sidebar update
      if (win.window) {
        win.window.dispatchEvent(new (win.window as any).CustomEvent('salonNameUpdated', { detail: salonName }))
      }
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
      const win = globalThis as any;
      if (win.window) {
        win.window.localStorage.removeItem('user');
      }
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

  const handleCreateBackup = async () => {
    setIsLoading(true);
    try {
      const response = await axios.post('/settings/backup', {}, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = (globalThis as any).window?.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "پشتیبان ایجاد شد",
        description: "فایل پشتیبان با موفقیت دانلود شد",
      });
    } catch (error: any) {
      console.error('Error creating backup:', error);
      toast({
        variant: "destructive",
        title: "خطا در ایجاد پشتیبان",
        description: error.response?.data?.message || "مشکلی در ایجاد پشتیبان پیش آمده است",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm('⚠️ آیا مطمئن هستید که می‌خواهید از این پشتیبان بازیابی کنید؟\n\nتمام داده‌های فعلی پاک خواهند شد و با داده‌های پشتیبان جایگزین می‌شوند!')) {
      event.target.value = '';
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('backupFile', file);
      
      const response = await axios.post('/settings/restore', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      toast({
        title: "بازیابی موفق",
        description: "داده‌ها با موفقیت از پشتیبان بازیابی شدند",
      });

      // Refresh page to show restored data
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Error restoring backup:', error);
      toast({
        variant: "destructive",
        title: "خطا در بازیابی",
        description: error.response?.data?.message || "مشکلی در بازیابی از پشتیبان پیش آمده است",
      });
    } finally {
      setIsLoading(false);
      event.target.value = '';
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
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-primary-foreground after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
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
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-primary-foreground after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </SettingsSection>

        {/* تنظیمات پشتیبان‌گیری */}
        <SettingsSection title="پشتیبان‌گیری و بازیابی" icon="Database">
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
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-primary-foreground after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleCreateBackup}
                disabled={isLoading}
              >
                <Icon name="Download" size={16} className="ml-2" />
                {isLoading ? 'در حال ایجاد...' : 'ایجاد پشتیبان'}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => document.getElementById('restoreFile')?.click()}
                disabled={isLoading}
              >
              <Icon name="Upload" size={16} className="ml-2" />
                بازیابی از پشتیبان
            </Button>
            </div>
            
            <input
              id="restoreFile"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleRestoreBackup}
            />
            
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 className="font-medium text-primary mb-2">📋 اطلاعات پشتیبان</h4>
              <div className="text-sm text-primary/80 space-y-1">
                <p>• پشتیبان شامل تمام داده‌های سیستم است</p>
                <p>• فرمت فایل: JSON</p>
                <p>• حداکثر سایز: 50 مگابایت</p>
                <p>• شامل: کاربران، مشتریان، نوبت‌ها، مالی و...</p>
              </div>
            </div>
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