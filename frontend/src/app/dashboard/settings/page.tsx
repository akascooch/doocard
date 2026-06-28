"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import api, { API_BASE_URL } from "../../../lib/axios"
import { isAxiosError } from "axios"
import { PasswordInput } from "@/components/ui/password-input"
import { clearFinancialAccess } from "@/lib/financial-reports-access"
import SyncStatusPanel from "@/components/offline/SyncStatusPanel"
import { hasPendingOutboxItems } from "@/lib/offline/outbox"

/** Configured axios client (auth interceptors, baseURL). */
const axios = api

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

const BACKUP_DOWNLOAD_TIMEOUT_MS = 300_000
const BACKUP_RESTORE_TIMEOUT_MS = 120_000

function logAxiosBackupDiagnostics(error: unknown): void {
  if (!isAxiosError(error)) {
    console.error('[backup] non-axios error:', error)
    return
  }
  console.error('[backup] axios error details:', {
    code: error.code,
    message: error.message,
    status: error.response?.status,
    responseURL: (error.request as XMLHttpRequest | undefined)?.responseURL,
    dataType:
      error.response?.data instanceof Blob
        ? `Blob(${error.response.data.size})`
        : typeof error.response?.data,
  })
}

async function parseAxiosBlobError(error: unknown): Promise<any> {
  if (!isAxiosError(error)) {
    return error
  }
  const data = error.response?.data
  if (!(data instanceof Blob)) {
    return {
      ...error,
      statusCode: error.response?.status,
      friendlyMessage:
        (data as any)?.message_fa || (data as any)?.message || error.message,
      correlationId: (data as any)?.correlationId,
      response: error.response,
    }
  }
  try {
    const text = await data.text()
    const parsed = JSON.parse(text)
    return {
      ...error,
      friendlyMessage: parsed.message_fa || parsed.message || error.message,
      statusCode: error.response?.status,
      correlationId: parsed.correlationId,
      response: {
        ...error.response,
        data: parsed,
      },
    }
  } catch {
    return error
  }
}

function isSessionExpiredError(error: any): boolean {
  return error?.statusCode === 401 || error?.response?.status === 401
}

function backupOperationErrorMessage(error: any, fallback: string): string {
  if (isSessionExpiredError(error)) {
    return 'لطفاً مجدداً وارد سیستم شوید (نشست منقضی شده)'
  }
  const status = error?.statusCode ?? error?.response?.status
  if (status === 500) {
    const correlationId =
      error?.correlationId ??
      error?.response?.data?.correlationId
    if (correlationId) {
      const base =
        error?.friendlyMessage ||
        error?.response?.data?.message_fa ||
        error?.response?.data?.message ||
        fallback
      return `${base} (شناسه خطا: ${correlationId})`
    }
  }
  return (
    error?.friendlyMessage ||
    error?.response?.data?.message_fa ||
    error?.response?.data?.message ||
    fallback
  )
}

export default function SettingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [salonName, setSalonName] = useState("")
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false)
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false)
  const [backupIntervalDays, setBackupIntervalDays] = useState(7)
  const [backupPath, setBackupPath] = useState("")
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null)
  const [backupSaving, setBackupSaving] = useState(false)
  const [backupConfigLoading, setBackupConfigLoading] = useState(true)
  const [backupConfigError, setBackupConfigError] = useState<string | null>(null)
  const [backupRunning, setBackupRunning] = useState(false)
  const [restoreRunning, setRestoreRunning] = useState(false)
  const [theme, setTheme] = useState("dark")
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [financialPasswordSet, setFinancialPasswordSet] = useState(false)
  const [financialCurrentPassword, setFinancialCurrentPassword] = useState("")
  const [financialNewPassword, setFinancialNewPassword] = useState("")
  const [financialConfirmPassword, setFinancialConfirmPassword] = useState("")
  const [financialPasswordLoading, setFinancialPasswordLoading] = useState(false)


  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const loadFinancialStatus = async () => {
      try {
        const res = await axios.get('/settings/financial-reports-password/status')
        setFinancialPasswordSet(!!res.data?.isSet)
      } catch {
        // ignore — admin-only endpoint
      }
    }
    loadFinancialStatus()
    const loadBackupConfig = async () => {
      setBackupConfigLoading(true)
      setBackupConfigError(null)
      try {
        const res = await axios.get('/settings/config')
        setAutoBackupEnabled(!!res.data?.autoBackupEnabled)
        setBackupIntervalDays(res.data?.backupIntervalDays ?? 7)
        setBackupPath(res.data?.backupPath ?? '')
        setLastBackupDate(res.data?.lastBackupDate ?? null)
      } catch (error: any) {
        setBackupConfigError(
          error?.friendlyMessage || error?.response?.data?.message || 'بارگذاری تنظیمات پشتیبان ناموفق بود',
        )
      } finally {
        setBackupConfigLoading(false)
      }
    }
    loadBackupConfig()
  }, [mounted])

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



  const saveBackupConfig = async (overrides?: {
    autoBackupEnabled?: boolean
    backupIntervalDays?: number
    backupPath?: string
  }) => {
    setBackupSaving(true)
    try {
      const res = await axios.patch('/settings/config', {
        autoBackupEnabled: overrides?.autoBackupEnabled ?? autoBackupEnabled,
        backupIntervalDays: overrides?.backupIntervalDays ?? backupIntervalDays,
        backupPath: (overrides?.backupPath ?? backupPath) || null,
      })
      setAutoBackupEnabled(!!res.data?.autoBackupEnabled)
      setBackupIntervalDays(res.data?.backupIntervalDays ?? 7)
      setBackupPath(res.data?.backupPath ?? '')
      setLastBackupDate(res.data?.lastBackupDate ?? null)
      toast({
        title: "تنظیمات پشتیبان ذخیره شد",
        description: "تغییرات پشتیبان‌گیری خودکار اعمال شد",
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطا در ذخیره تنظیمات پشتیبان",
        description: error?.response?.data?.message || error?.friendlyMessage || "لطفا دوباره تلاش کنید",
      })
    } finally {
      setBackupSaving(false)
    }
  }

  const handleAutoBackupToggle = async (enabled: boolean) => {
    setAutoBackupEnabled(enabled)
    await saveBackupConfig({ autoBackupEnabled: enabled })
  }

  const handleSaveSettings = async () => {
    setIsLoading(true)
    try {
      const win = globalThis as any;
      if (win.window) {
        win.window.localStorage.setItem('salonName', salonName)
      }
      
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
    setBackupRunning(true);
    const backupPath = '/settings/backup/run';
    const apiOrigin = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    console.log('[backup] stage request:', {
      postUrl: `${API_BASE_URL}${backupPath}`,
      apiOrigin,
    });

    try {
      const response = await api.post(
        backupPath,
        {},
        { timeout: BACKUP_DOWNLOAD_TIMEOUT_MS },
      );

      const downloadId = response.data?.downloadId as string | undefined;
      const fileName =
        (response.data?.fileName as string | undefined) ||
        `doocard-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

      if (!downloadId) {
        throw new Error('شناسه دانلود از سرور دریافت نشد');
      }

      const directDownloadUrl = `${apiOrigin}/api/settings/backup/download-direct/${encodeURIComponent(downloadId)}`;
      console.log('[backup] triggering browser download:', directDownloadUrl);

      const link = document.createElement('a');
      link.href = directDownloadUrl;
      link.setAttribute('download', fileName);
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast({
        title: "پشتیبان ایجاد شد",
        description: "دانلود فایل پشتیبان در مرورگر آغاز شد",
      });
    } catch (error: unknown) {
      logAxiosBackupDiagnostics(error);
      const parsedError = await parseAxiosBlobError(error);
      console.error('[backup] parsed error:', {
        message: parsedError?.friendlyMessage || parsedError?.message,
        status: parsedError?.statusCode ?? parsedError?.response?.status,
        correlationId: parsedError?.correlationId,
      });
      toast({
        variant: "destructive",
        title: "خطا در ایجاد پشتیبان",
        description: backupOperationErrorMessage(parsedError, "مشکلی در ایجاد پشتیبان پیش آمده است"),
      });
    } finally {
      setBackupRunning(false);
    }
  };

  const handleRestoreBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const pendingOffline = await hasPendingOutboxItems();
    if (pendingOffline) {
      toast({
        variant: "destructive",
        title: "بازیابی مسدود شد",
        description: "قبل از بازیابی بکاپ، ابتدا اطلاعات آفلاین را همگام‌سازی کنید.",
      });
      event.target.value = '';
      return;
    }

    if (!confirm('⚠️ آیا مطمئن هستید که می‌خواهید از این پشتیبان بازیابی کنید؟\n\nتمام داده‌های فعلی پاک خواهند شد و با داده‌های پشتیبان جایگزین می‌شوند!')) {
      event.target.value = '';
      return;
    }

    setRestoreRunning(true);
    try {
      const formData = new FormData();
      formData.append('backupFile', file);

      await axios.post('/settings/backup/restore', formData, {
        timeout: BACKUP_RESTORE_TIMEOUT_MS,
      });

      toast({
        title: "بازیابی موفق",
        description: "داده‌ها با موفقیت از پشتیبان بازیابی شدند",
      });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Error restoring backup:', error);
      toast({
        variant: "destructive",
        title: "خطا در بازیابی",
        description: backupOperationErrorMessage(error, "مشکلی در بازیابی از پشتیبان پیش آمده است"),
      });
    } finally {
      setRestoreRunning(false);
      event.target.value = '';
    }
  };

  const handleFinancialPasswordSubmit = async () => {
    if (financialNewPassword.length < 6) {
      toast({
        title: "خطا",
        description: "رمز جدید باید حداقل ۶ کاراکتر باشد.",
        variant: "destructive",
      })
      return
    }
    if (financialNewPassword !== financialConfirmPassword) {
      toast({
        title: "خطا",
        description: "تکرار رمز جدید مطابقت ندارد.",
        variant: "destructive",
      })
      return
    }
    if (financialPasswordSet && !financialCurrentPassword) {
      toast({
        title: "خطا",
        description: "رمز فعلی الزامی است.",
        variant: "destructive",
      })
      return
    }

    setFinancialPasswordLoading(true)
    const wasAlreadySet = financialPasswordSet
    try {
      const body: { newPassword: string; currentPassword?: string } = {
        newPassword: financialNewPassword,
      }
      if (financialPasswordSet) {
        body.currentPassword = financialCurrentPassword
      }
      await axios.post('/settings/financial-reports-password', body)
      clearFinancialAccess()
      setFinancialPasswordSet(true)
      setFinancialCurrentPassword("")
      setFinancialNewPassword("")
      setFinancialConfirmPassword("")
      toast({
        title: wasAlreadySet
          ? "رمز گزارشات مالی با موفقیت تغییر کرد."
          : "رمز گزارشات مالی با موفقیت ثبت شد.",
      })
    } catch (error: any) {
      const status = error?.response?.status ?? error?.statusCode
      toast({
        title: "خطا",
        description:
          status === 401
            ? "رمز فعلی اشتباه است."
            : error?.response?.data?.message || "خطا در ذخیره رمز گزارشات مالی",
        variant: "destructive",
      })
    } finally {
      setFinancialPasswordLoading(false)
    }
  }

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
                  checked={emailNotificationsEnabled}
                  onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-primary-foreground after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </SettingsSection>

        {/* همگام‌سازی آفلاین */}
        <SettingsSection title="همگام‌سازی آفلاین" icon="Cloud">
          <SyncStatusPanel />
        </SettingsSection>

        {/* تنظیمات پشتیبان‌گیری */}
        <SettingsSection title="پشتیبان‌گیری و بازیابی" icon="Database">
          <div className="space-y-4">
            {backupConfigLoading && (
              <p className="text-sm text-muted-foreground">در حال بارگذاری تنظیمات پشتیبان...</p>
            )}
            {backupConfigError && (
              <p className="text-sm text-destructive">{backupConfigError}</p>
            )}

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">پشتیبان‌گیری خودکار</h3>
                <p className="text-sm text-muted-foreground">
                  پشتیبان‌گیری دوره‌ای در پوشه محلی سرور
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => handleAutoBackupToggle(e.target.checked)}
                  disabled={backupSaving || backupConfigLoading}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-primary-foreground after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-primary-foreground after:border-border after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">فاصله پشتیبان‌گیری (روز)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={backupIntervalDays}
                onChange={(e) => setBackupIntervalDays(Number(e.target.value) || 7)}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">مسیر ذخیره پشتیبان (محلی)</label>
              <input
                type="text"
                value={backupPath}
                onChange={(e) => setBackupPath(e.target.value)}
                placeholder="مثال: C:\Users\a.hosseini\Desktop\apk\backups"
                dir="ltr"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-all text-left"
              />
              <p className="mt-1 text-sm text-muted-foreground">
                مسیر روی همان ماشینی که بک‌اند اجرا می‌شود ذخیره می‌شود
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => saveBackupConfig()}
              disabled={backupSaving || backupConfigLoading}
            >
              {backupSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات پشتیبان'}
            </Button>

            {lastBackupDate && (
              <p className="text-sm text-muted-foreground">
                آخرین پشتیبان: {new Date(lastBackupDate).toLocaleString('fa-IR')}
              </p>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleCreateBackup}
                disabled={backupRunning || restoreRunning || backupConfigLoading}
              >
                <Icon name="Download" size={16} className="ml-2" />
                {backupRunning ? 'در حال دانلود...' : 'ایجاد پشتیبان'}
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => document.getElementById('restoreFile')?.click()}
                disabled={backupRunning || restoreRunning || backupConfigLoading}
              >
              <Icon name="Upload" size={16} className="ml-2" />
                {restoreRunning ? 'در حال پردازش داده (لطفاً ~۳۰ ثانیه صبر کنید)...' : 'بازیابی از پشتیبان'}
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
                <p>• حداکثر سایز: 300 مگابایت</p>
                <p>• شامل: کاربران، مشتریان، نوبت‌ها، مالی و...</p>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* امنیت گزارشات مالی */}
        <SettingsSection title="امنیت گزارشات مالی" icon="Lock">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              رمز جداگانه برای دسترسی به صفحه گزارشات مالی. این رمز با رمز ورود سیستم متفاوت است.
            </p>
            {financialPasswordSet && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">رمز فعلی</label>
                <PasswordInput
                  value={financialCurrentPassword}
                  onChange={(e) => setFinancialCurrentPassword(e.target.value)}
                  placeholder="رمز فعلی گزارشات مالی"
                />
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-sm font-medium">رمز جدید</label>
              <PasswordInput
                value={financialNewPassword}
                onChange={(e) => setFinancialNewPassword(e.target.value)}
                placeholder="حداقل ۶ کاراکتر"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">تکرار رمز جدید</label>
              <PasswordInput
                value={financialConfirmPassword}
                onChange={(e) => setFinancialConfirmPassword(e.target.value)}
                placeholder="تکرار رمز جدید"
              />
            </div>
            <Button
              onClick={handleFinancialPasswordSubmit}
              disabled={financialPasswordLoading}
              className="w-full"
            >
              {financialPasswordLoading
                ? 'در حال ذخیره...'
                : financialPasswordSet
                  ? 'تغییر رمز گزارشات مالی'
                  : 'ثبت رمز گزارشات مالی'}
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