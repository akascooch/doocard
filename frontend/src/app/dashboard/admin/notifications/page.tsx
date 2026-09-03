'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '@/lib/axios'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Bell, History, Megaphone, MessageSquare, RefreshCw, Send, User, Users } from 'lucide-react'
import { formatToJalali } from '@/lib/date'
import { getUserRoleLabel } from '@/lib/user-roles'
import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import { AdminSmsManagementPanel } from './SmsManagementPanel'

type DeliveryType = 'IN_APP' | 'PUSH' | 'BOTH' | 'SMS' | 'IN_APP_SMS' | 'ALL'
type RecipientMode = 'single' | 'multi' | 'role'
type PageTab = 'send' | 'sms'

interface AppUser {
  id: number
  name: string
  phone: string
  role: string
}

interface NotificationHistoryItem {
  id: number
  title: string
  message: string
  type: string
  roleTarget?: string | null
  userIdTarget?: number | null
  createdAt: string
  user?: {
    id: number
    name: string
    phone: string
    role: string
  } | null
}

const DELIVERY_OPTIONS: { value: DeliveryType; label: string }[] = [
  { value: 'IN_APP', label: 'فقط درون‌برنامه‌ای' },
  { value: 'PUSH', label: 'فقط Push' },
  { value: 'BOTH', label: 'درون‌برنامه‌ای + Push' },
  { value: 'SMS', label: 'فقط SMS (نیاز به فعال بودن قانون)' },
  { value: 'IN_APP_SMS', label: 'درون‌برنامه‌ای + SMS' },
  { value: 'ALL', label: 'همه کانال‌ها' },
]

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'مدیر (ADMIN)' },
  { value: 'EMPLOYEE', label: 'کارمند (EMPLOYEE)' },
  { value: 'CUSTOMER', label: 'مشتری (CUSTOMER)' },
]

function formatRecipient(item: NotificationHistoryItem): string {
  if (item.userIdTarget && item.user) {
    return `${item.user.name} (#${item.userIdTarget})`
  }
  if (item.userIdTarget) {
    return `کاربر #${item.userIdTarget}`
  }
  if (item.roleTarget) {
    return `نقش: ${getUserRoleLabel(item.roleTarget)}`
  }
  return 'همه کاربران'
}

export default function AdminNotificationsPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'sms' ? 'sms' : 'send'
  const [tab, setTab] = useState<PageTab>(initialTab)
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [users, setUsers] = useState<AppUser[]>([])
  const [history, setHistory] = useState<NotificationHistoryItem[]>([])
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('single')
  const [form, setForm] = useState({
    title: '',
    message: '',
    deliveryType: 'BOTH' as DeliveryType,
    singleUserId: '',
    selectedUserIds: [] as number[],
    roleTarget: 'ADMIN',
    userSearch: '',
  })

  const loadUsers = useCallback(async () => {
    try {
      const response = await api.get('/users')
      setUsers(Array.isArray(response.data) ? response.data : response.data?.users ?? [])
    } catch (error: any) {
      toast({
        title: 'خطا در بارگذاری کاربران',
        description: error?.response?.data?.message || 'امکان دریافت لیست کاربران نیست',
        variant: 'destructive',
      })
    }
  }, [toast])

  const loadHistory = useCallback(async () => {
    try {
      setHistoryLoading(true)
      const response = await api.get('/notifications/admin/history', { params: { limit: 100 } })
      setHistory(Array.isArray(response.data) ? response.data : [])
    } catch (error: any) {
      toast({
        title: 'خطا در بارگذاری تاریخچه',
        description: error?.response?.data?.message || 'امکان دریافت تاریخچه اعلان‌ها نیست',
        variant: 'destructive',
      })
    } finally {
      setHistoryLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadUsers()
    loadHistory()
  }, [loadUsers, loadHistory])

  const filteredUsers = useMemo(() => {
    const term = form.userSearch.trim().toLowerCase()
    if (!term) return users.slice(0, 50)
    return users
      .filter(
        (user) =>
          user.name?.toLowerCase().includes(term) ||
          user.phone?.includes(term) ||
          String(user.id).includes(term),
      )
      .slice(0, 50)
  }, [form.userSearch, users])

  const toggleSelectedUser = (userId: number) => {
    setForm((prev) => ({
      ...prev,
      selectedUserIds: prev.selectedUserIds.includes(userId)
        ? prev.selectedUserIds.filter((id) => id !== userId)
        : [...prev.selectedUserIds, userId],
    }))
  }

  const sendInApp = async (payload: {
    userIdTarget?: number
    roleTarget?: string
    sendSms?: boolean
  }) => {
    await api.post('/notifications', {
      title: form.title.trim(),
      message: form.message.trim(),
      type: 'GENERAL',
      sendSms: !!payload.sendSms,
      userIdTarget: payload.userIdTarget,
      roleTarget: payload.roleTarget,
    })
  }

  const sendPushToUser = async (userId: number) => {
    await api.post('/push-notifications/admin/send-to-user', {
      userId,
      title: form.title.trim(),
      body: form.message.trim(),
      url: '/dashboard/notifications',
    })
  }

  const sendPushToRole = async (role: string) => {
    await api.post('/push-notifications/admin/test-role', {
      role,
      title: form.title.trim(),
      body: form.message.trim(),
      url: '/dashboard/notifications',
    })
  }

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast({
        title: 'فیلدهای الزامی',
        description: 'عنوان و متن اعلان را وارد کنید',
        variant: 'destructive',
      })
      return
    }

    const sendInAppEnabled =
      form.deliveryType === 'IN_APP' ||
      form.deliveryType === 'BOTH' ||
      form.deliveryType === 'IN_APP_SMS' ||
      form.deliveryType === 'ALL'
    const sendPushEnabled =
      form.deliveryType === 'PUSH' ||
      form.deliveryType === 'BOTH' ||
      form.deliveryType === 'ALL'
    const sendSmsEnabled =
      form.deliveryType === 'SMS' ||
      form.deliveryType === 'IN_APP_SMS' ||
      form.deliveryType === 'ALL'

    try {
      setLoading(true)

      if (recipientMode === 'single') {
        const userId = Number(form.singleUserId)
        if (!Number.isFinite(userId) || userId <= 0) {
          throw new Error('کاربر مقصد را انتخاب کنید')
        }
        if (sendInAppEnabled || sendSmsEnabled) {
          await sendInApp({ userIdTarget: userId, sendSms: sendSmsEnabled })
        }
        if (sendPushEnabled) await sendPushToUser(userId)
      } else if (recipientMode === 'multi') {
        if (form.selectedUserIds.length === 0) {
          throw new Error('حداقل یک کاربر را انتخاب کنید')
        }
        const tasks: Promise<unknown>[] = []
        for (const userId of form.selectedUserIds) {
          if (sendInAppEnabled || sendSmsEnabled) {
            tasks.push(sendInApp({ userIdTarget: userId, sendSms: sendSmsEnabled }))
          }
          if (sendPushEnabled) tasks.push(sendPushToUser(userId))
        }
        await Promise.all(tasks)
      } else {
        if (sendInAppEnabled || sendSmsEnabled) {
          await sendInApp({ roleTarget: form.roleTarget, sendSms: sendSmsEnabled })
        }
        if (sendPushEnabled) await sendPushToRole(form.roleTarget)
      }

      toast({ title: 'ارسال موفق', description: 'اعلان با موفقیت ارسال شد' })
      setForm((prev) => ({
        ...prev,
        title: '',
        message: '',
        singleUserId: '',
        selectedUserIds: [],
        userSearch: '',
      }))
      await loadHistory()
    } catch (error: any) {
      toast({
        title: 'خطا در ارسال',
        description: error?.response?.data?.message || error?.message || 'ارسال اعلان ناموفق بود',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Megaphone className="w-8 h-8" />
          مدیریت اعلان‌ها
        </h1>
        <p className="text-muted-foreground mt-2">ارسال اعلان درون‌برنامه‌ای، Push و مدیریت SMS</p>
        <div className="flex gap-2 mt-4">
          <Button
            type="button"
            variant={tab === 'send' ? 'default' : 'outline'}
            onClick={() => setTab('send')}
          >
            <Megaphone className="w-4 h-4 ml-2" />
            ارسال اعلان
          </Button>
          <Button
            type="button"
            variant={tab === 'sms' ? 'default' : 'outline'}
            onClick={() => setTab('sms')}
          >
            <MessageSquare className="w-4 h-4 ml-2" />
            مدیریت پیامک
          </Button>
        </div>
      </div>

      {tab === 'sms' ? (
        <AdminSmsManagementPanel />
      ) : (
      <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            ارسال اعلان سفارشی
          </CardTitle>
          <CardDescription>عنوان، متن، نوع تحویل و مخاطب را مشخص کنید</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">عنوان</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="عنوان اعلان"
              />
            </div>
            <div className="space-y-2">
              <Label>نوع تحویل</Label>
              <Select
                value={form.deliveryType}
                onValueChange={(value) => setForm({ ...form, deliveryType: value as DeliveryType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="نوع تحویل" />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">متن پیام</Label>
            <Textarea
              id="message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="متن اعلان"
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <Label>مخاطب</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={recipientMode === 'single' ? 'default' : 'outline'}
                onClick={() => setRecipientMode('single')}
              >
                <User className="w-4 h-4 ml-2" />
                تکی
              </Button>
              <Button
                type="button"
                variant={recipientMode === 'multi' ? 'default' : 'outline'}
                onClick={() => setRecipientMode('multi')}
              >
                <Users className="w-4 h-4 ml-2" />
                گروهی انتخابی
              </Button>
              <Button
                type="button"
                variant={recipientMode === 'role' ? 'default' : 'outline'}
                onClick={() => setRecipientMode('role')}
              >
                <Bell className="w-4 h-4 ml-2" />
                نقش کاربری
              </Button>
            </div>
          </div>

          {recipientMode === 'single' && (
            <div className="space-y-2">
              <Label>انتخاب کاربر</Label>
              <Input
                value={form.userSearch}
                onChange={(e) => setForm({ ...form, userSearch: e.target.value })}
                placeholder="جستجو با نام، موبایل یا شناسه"
              />
              <Select
                value={form.singleUserId}
                onValueChange={(value) => setForm({ ...form, singleUserId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="یک کاربر انتخاب کنید" />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name} — {user.phone} ({getUserRoleLabel(user.role)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {recipientMode === 'multi' && (
            <div className="space-y-2">
              <Label>انتخاب چند کاربر</Label>
              <Input
                value={form.userSearch}
                onChange={(e) => setForm({ ...form, userSearch: e.target.value })}
                placeholder="جستجو با نام، موبایل یا شناسه"
              />
              <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
                {filteredUsers.map((user) => {
                  const selected = form.selectedUserIds.includes(user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleSelectedUser(user.id)}
                      className={cn(
                        'w-full text-right px-4 py-3 hover:bg-muted/50 transition-colors',
                        selected && 'bg-primary/10',
                      )}
                    >
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.phone} • {getUserRoleLabel(user.role)} • #{user.id}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {recipientMode === 'role' && (
            <div className="space-y-2">
              <Label>نقش مقصد</Label>
              <Select
                value={form.roleTarget}
                onValueChange={(value) => setForm({ ...form, roleTarget: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب نقش" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSubmit} disabled={loading} className="w-full md:w-auto">
            <Send className="w-4 h-4 ml-2" />
            {loading ? 'در حال ارسال...' : 'ارسال اعلان'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              تاریخچه اعلان‌ها
            </CardTitle>
            <CardDescription>آخرین اعلان‌های ثبت‌شده در سیستم</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadHistory} disabled={historyLoading}>
            <RefreshCw className={cn('w-4 h-4 ml-2', historyLoading && 'animate-spin')} />
            بروزرسانی
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>عنوان</TableHead>
                  <TableHead>متن</TableHead>
                  <TableHead>مخاطب</TableHead>
                  <TableHead>نوع</TableHead>
                  <TableHead>تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {historyLoading ? 'در حال بارگذاری...' : 'اعلانی یافت نشد'}
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="max-w-xs truncate">{item.message}</TableCell>
                      <TableCell>{formatRecipient(item)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.type}</Badge>
                      </TableCell>
                      <TableCell>{formatToJalali(item.createdAt, 'YYYY/MM/DD HH:mm')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </>
      )}
    </div>
  )
}
