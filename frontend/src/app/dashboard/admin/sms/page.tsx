'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '@/lib/axios'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  FileText,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ScrollText,
} from 'lucide-react'
import { formatToJalali } from '@/lib/date'
import { cn } from '@/lib/utils'

interface SmsStatus {
  provider: string
  smsEnabledEnv: boolean
  apiKeyConfigured: boolean
  lineConfigured: boolean
  architecture?: string
  note?: string
}

interface SmsTemplateRow {
  id: number
  templateKey: string
  label: string
  description?: string
  content: string
  allowedVariables: string[]
  isActive: boolean
  preview: string
  updatedAt?: string
}

interface SmsEventRow {
  id: number
  eventType?: string | null
  templateKey?: string | null
  recipientType?: string | null
  toMasked: string
  status: string
  appointmentId?: number | null
  customerUserId?: number | null
  adminId?: number | null
  customerId?: number | null
  barberId?: number | null
  createdAt: string
  messagePreview?: string | null
  providerError?: string | null
  rejectReason?: string | null
}

interface AppointmentSmsReport {
  appointmentId: number
  customerId?: number | null
  barberId?: number | null
  customerSms: { status: string; reason?: string | null }
  barberSms: { status: string; reason?: string | null }
  items: SmsEventRow[]
}

function statusBadgeVariant(status: string) {
  if (status === 'SENT') return 'default' as const
  if (status === 'FAILED') return 'destructive' as const
  if (status === 'BLOCKED' || status === 'SKIPPED') return 'outline' as const
  return 'secondary' as const
}

export default function AdminSmsPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState('send')
  const [status, setStatus] = useState<SmsStatus | null>(null)
  const [templates, setTemplates] = useState<SmsTemplateRow[]>([])
  const [events, setEvents] = useState<SmsEventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [templateQuery, setTemplateQuery] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editDescription, setEditDescription] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [sendPhone, setSendPhone] = useState('')
  const [sendMessage, setSendMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [appointmentIdFilter, setAppointmentIdFilter] = useState('')
  const [appointmentReport, setAppointmentReport] = useState<AppointmentSmsReport | null>(null)

  const loadStatus = useCallback(async () => {
    const res = await api.get('/sms/admin/status')
    setStatus(res.data)
  }, [])

  const loadTemplates = useCallback(async (q?: string) => {
    const res = await api.get('/sms/admin/templates', {
      params: { q: q || undefined, includeInactive: 'true' },
    })
    setTemplates(Array.isArray(res.data) ? res.data : [])
  }, [])

  const loadEvents = useCallback(async () => {
    const res = await api.get('/sms/admin/events', { params: { limit: 100 } })
    setEvents(Array.isArray(res.data) ? res.data : [])
  }, [])

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      await Promise.all([loadStatus(), loadTemplates(templateQuery), loadEvents()])
    } catch (error: any) {
      toast({
        title: 'خطا در بارگذاری پنل پیامک',
        description: error?.response?.data?.message || 'درخواست ناموفق بود',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [loadEvents, loadStatus, loadTemplates, templateQuery, toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const filteredTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase()
    if (!q) return templates
    return templates.filter(
      (t) =>
        t.templateKey.toLowerCase().includes(q) ||
        t.label.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q),
    )
  }, [templates, templateQuery])

  const startEdit = (t: SmsTemplateRow) => {
    setEditingKey(t.templateKey)
    setEditContent(t.content)
    setEditActive(t.isActive)
    setEditDescription(t.description || '')
  }

  const saveTemplate = async () => {
    if (!editingKey) return
    try {
      setSavingTemplate(true)
      const res = await api.patch(`/sms/admin/templates/${editingKey}`, {
        content: editContent,
        isActive: editActive,
        description: editDescription,
      })
      toast({
        title: 'قالب ذخیره شد',
        description: res.data?.note || 'هیچ پیامکی ارسال نشد',
      })
      setEditingKey(null)
      await loadTemplates(templateQuery)
    } catch (error: any) {
      toast({
        title: 'خطا در ذخیره قالب',
        description: error?.response?.data?.message || 'ذخیره ناموفق بود',
        variant: 'destructive',
      })
    } finally {
      setSavingTemplate(false)
    }
  }

  const sendCustom = async () => {
    if (!sendPhone.trim()) {
      toast({ title: 'شماره لازم است', variant: 'destructive' })
      return
    }
    if (!sendMessage.trim()) {
      toast({ title: 'متن پیام لازم است', variant: 'destructive' })
      return
    }
    try {
      setSending(true)
      const res = await api.post('/sms/admin/send-custom', {
        phone: sendPhone.trim(),
        message: sendMessage.trim(),
      })
      if (res.data?.success) {
        toast({ title: 'ارسال شد', description: 'پیامک سفارشی ارسال شد' })
        setSendMessage('')
        await loadEvents()
      } else {
        toast({
          title: 'ارسال ناموفق',
          description: res.data?.error || 'ارائه‌دهنده پاسخ خطا داد',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error?.response?.data?.message || 'ارسال ناموفق بود',
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  const loadAppointmentReport = async () => {
    const id = appointmentIdFilter.trim()
    if (!id) {
      setAppointmentReport(null)
      return
    }
    try {
      const res = await api.get(`/sms/admin/events/by-appointment/${id}`)
      setAppointmentReport(res.data)
    } catch (error: any) {
      toast({
        title: 'خطا در گزارش نوبت',
        description: error?.response?.data?.message || 'دریافت گزارش ناموفق بود',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            مدیریت پیامک
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ارسال سفارشی، ویرایش قالب‌ها و گزارش تحویل — بدون افشای کلید یا مسیر legacy
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
          <RefreshCw className={cn('w-4 h-4 ml-2', loading && 'animate-spin')} />
          بروزرسانی
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">وضعیت ارائه‌دهنده</CardTitle>
          <CardDescription>فقط وضعیت پیکربندی — هیچ secret در UI نیست</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge variant="secondary">provider: {status?.provider ?? '—'}</Badge>
          <Badge variant={status?.smsEnabledEnv ? 'default' : 'outline'}>
            SMS_ENABLED: {status?.smsEnabledEnv ? 'true' : 'false'}
          </Badge>
          <Badge variant={status?.apiKeyConfigured ? 'default' : 'outline'}>
            API key: {status?.apiKeyConfigured ? 'configured' : 'missing'}
          </Badge>
          <Badge variant={status?.lineConfigured ? 'default' : 'outline'}>
            line: {status?.lineConfigured ? 'configured' : 'missing'}
          </Badge>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="send">
            <Send className="w-4 h-4 ml-1" />
            ارسال سفارشی
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="w-4 h-4 ml-1" />
            قالب‌ها
          </TabsTrigger>
          <TabsTrigger value="reports">
            <ScrollText className="w-4 h-4 ml-1" />
            گزارش‌ها
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>ارسال پیامک سفارشی</CardTitle>
              <CardDescription>
                فقط ADMIN — حداکثر ۵ ارسال در دقیقه. متن آزاد اپ؛ شناسه قالب sms.ir استفاده نمی‌شود.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div className="space-y-2">
                <Label>شماره موبایل</Label>
                <Input
                  value={sendPhone}
                  onChange={(e) => setSendPhone(e.target.value)}
                  placeholder="0912..."
                  dir="ltr"
                  className="text-left"
                />
              </div>
              <div className="space-y-2">
                <Label>متن پیام</Label>
                <Textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  rows={5}
                  maxLength={500}
                  placeholder="متن پیامک..."
                />
                <p className="text-xs text-muted-foreground">{sendMessage.length}/500</p>
              </div>
              <Button onClick={sendCustom} disabled={sending}>
                <Send className="w-4 h-4 ml-2" />
                {sending ? 'در حال ارسال...' : 'ارسال'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>قالب‌های پیامک سیستم</CardTitle>
              <CardDescription>
                ذخیره قالب فقط دیتابیس را به‌روز می‌کند و هیچ پیامکی ارسال نمی‌کند
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pr-9"
                    value={templateQuery}
                    onChange={(e) => setTemplateQuery(e.target.value)}
                    placeholder="جست‌وجو بر اساس کلید یا متن..."
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadTemplates(templateQuery)}
                >
                  جست‌وجو
                </Button>
              </div>

              <div className="space-y-3">
                {filteredTemplates.map((t) => (
                  <div key={t.templateKey} className="border rounded-lg p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{t.label}</div>
                        <div className="text-xs font-mono text-muted-foreground">
                          {t.templateKey}
                        </div>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={t.isActive ? 'default' : 'outline'}>
                          {t.isActive ? 'فعال' : 'غیرفعال'}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => startEdit(t)}>
                          ویرایش
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm whitespace-pre-wrap bg-muted/40 rounded-md p-3">
                      {t.preview}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(t.allowedVariables || []).map((v) => (
                        <Badge key={v} variant="secondary" className="font-mono text-xs">
                          {`{${v}}`}
                        </Badge>
                      ))}
                      {(t.allowedVariables || []).length === 0 && (
                        <span className="text-xs text-muted-foreground">بدون متغیر</span>
                      )}
                    </div>

                    {editingKey === t.templateKey && (
                      <div className="border-t pt-3 space-y-3">
                        <div className="space-y-2">
                          <Label>توضیح / کاربرد</Label>
                          <Input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            maxLength={500}
                            placeholder="شرح کوتاه برای ادمین"
                          />
                        </div>
                        <Label>متن قالب</Label>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={8}
                          maxLength={1000}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={editActive ? 'default' : 'outline'}
                            onClick={() => setEditActive((v) => !v)}
                          >
                            {editActive ? 'فعال' : 'غیرفعال'}
                          </Button>
                          <Button size="sm" onClick={saveTemplate} disabled={savingTemplate}>
                            {savingTemplate ? 'در حال ذخیره...' : 'ذخیره (بدون ارسال)'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingKey(null)}
                          >
                            انصراف
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {filteredTemplates.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center">
                    قالبی یافت نشد
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>گزارش نوبت‌محور</CardTitle>
              <CardDescription>
                وضعیت پیامک مشتری و آرایشگر برای یک نوبت مشخص
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="space-y-2">
                  <Label>شناسه نوبت</Label>
                  <Input
                    value={appointmentIdFilter}
                    onChange={(e) => setAppointmentIdFilter(e.target.value)}
                    placeholder="مثلاً 1234"
                    dir="ltr"
                    className="w-40 text-left"
                  />
                </div>
                <Button onClick={loadAppointmentReport}>بررسی</Button>
              </div>
              {appointmentReport && (
                <div className="space-y-2 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      نوبت #{appointmentReport.appointmentId}
                    </Badge>
                    {appointmentReport.customerId != null && (
                      <Badge variant="outline">customerId: {appointmentReport.customerId}</Badge>
                    )}
                    {appointmentReport.barberId != null && (
                      <Badge variant="outline">barberId: {appointmentReport.barberId}</Badge>
                    )}
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="border rounded-md p-3">
                      <div className="font-medium mb-1">مشتری</div>
                      <Badge variant={statusBadgeVariant(appointmentReport.customerSms.status)}>
                        {appointmentReport.customerSms.status}
                      </Badge>
                      {appointmentReport.customerSms.reason && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {appointmentReport.customerSms.reason}
                        </p>
                      )}
                    </div>
                    <div className="border rounded-md p-3">
                      <div className="font-medium mb-1">آرایشگر</div>
                      <Badge variant={statusBadgeVariant(appointmentReport.barberSms.status)}>
                        {appointmentReport.barberSms.status}
                      </Badge>
                      {appointmentReport.barberSms.reason && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {appointmentReport.barberSms.reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>آخرین ارسال‌ها</CardTitle>
              <CardDescription>شماره‌ها ماسک‌شده‌اند؛ بدون secret یا payload خام</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>گیرنده</TableHead>
                      <TableHead>شماره</TableHead>
                      <TableHead>رویداد</TableHead>
                      <TableHead>قالب</TableHead>
                      <TableHead>نوبت</TableHead>
                      <TableHead>وضعیت</TableHead>
                      <TableHead>زمان</TableHead>
                      <TableHead>علت / خطا</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          رویدادی نیست
                        </TableCell>
                      </TableRow>
                    ) : (
                      events.map((ev) => (
                        <TableRow key={ev.id}>
                          <TableCell>{ev.recipientType || '—'}</TableCell>
                          <TableCell className="font-mono text-xs" dir="ltr">
                            {ev.toMasked}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{ev.eventType || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{ev.templateKey || '—'}</TableCell>
                          <TableCell>{ev.appointmentId ?? '—'}</TableCell>
                          <TableCell>
                            <Badge variant={statusBadgeVariant(ev.status)}>{ev.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {formatToJalali(ev.createdAt)}
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate">
                            {ev.rejectReason || ev.providerError || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
