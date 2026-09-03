'use client'

import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/axios'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, RefreshCw, Send } from 'lucide-react'
import { formatToJalali } from '@/lib/date'
import { cn } from '@/lib/utils'

interface SmsStatus {
  provider: string
  smsEnabledEnv: boolean
  apiKeyConfigured: boolean
  lineConfigured: boolean
}

interface SmsRule {
  eventKey: string
  label?: string | null
  smsEnabled: boolean
  updatedAt?: string
}

interface SmsEventRow {
  id: number
  eventKey?: string | null
  dedupeKey?: string | null
  to: string
  status: string
  message?: string | null
  createdAt: string
  attempts?: number
}

export function AdminSmsManagementPanel() {
  const { toast } = useToast()
  const [status, setStatus] = useState<SmsStatus | null>(null)
  const [rules, setRules] = useState<SmsRule[]>([])
  const [events, setEvents] = useState<SmsEventRow[]>([])
  const [loading, setLoading] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [testing, setTesting] = useState(false)

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      const [statusRes, rulesRes, eventsRes] = await Promise.all([
        api.get('/sms/admin/status'),
        api.get('/sms/admin/rules'),
        api.get('/sms/admin/events', { params: { limit: 50 } }),
      ])
      setStatus(statusRes.data)
      setRules(Array.isArray(rulesRes.data) ? rulesRes.data : [])
      setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : [])
    } catch (error: any) {
      toast({
        title: 'خطا در بارگذاری SMS',
        description: error?.response?.data?.message || 'امکان دریافت وضعیت پیامک نیست',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const toggleRule = async (eventKey: string, smsEnabled: boolean) => {
    try {
      await api.patch('/sms/admin/rules', { eventKey, smsEnabled })
      setRules((prev) =>
        prev.map((r) => (r.eventKey === eventKey ? { ...r, smsEnabled } : r)),
      )
      toast({ title: 'ذخیره شد', description: 'قانون پیامک به‌روزرسانی شد' })
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error?.response?.data?.message || 'ذخیره قانون ناموفق بود',
        variant: 'destructive',
      })
    }
  }

  const sendTest = async () => {
    if (!testPhone.trim()) {
      toast({ title: 'شماره لازم است', variant: 'destructive' })
      return
    }
    try {
      setTesting(true)
      const res = await api.post('/sms/admin/test', {
        phone: testPhone.trim(),
        message: testMessage.trim() || undefined,
      })
      if (res.data?.success) {
        toast({ title: 'ارسال شد', description: 'پیامک آزمایشی ارسال شد' })
        await loadAll()
      } else {
        toast({
          title: 'ارسال ناموفق',
          description: res.data?.error || 'ارائه‌دهنده پیامک پاسخ خطا داد',
          variant: 'destructive',
        })
      }
    } catch (error: any) {
      toast({
        title: 'خطا',
        description: error?.response?.data?.message || 'ارسال آزمایشی ناموفق بود',
        variant: 'destructive',
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              وضعیت ارائه‌دهنده SMS
            </CardTitle>
            <CardDescription>
              فقط وضعیت پیکربندی نمایش داده می‌شود — کلیدها هرگز در UI نیست
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={cn('w-4 h-4 ml-2', loading && 'animate-spin')} />
            بروزرسانی
          </Button>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
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

      <Card>
        <CardHeader>
          <CardTitle>قوانین ارسال پیامک</CardTitle>
          <CardDescription>
            فقط رویدادهای مجاز پیامک می‌گیرند. خاموش کردن، ارسال را برای آن رویداد متوقف می‌کند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.eventKey}
              className="flex items-center justify-between gap-4 border rounded-lg px-4 py-3"
            >
              <div>
                <div className="font-medium">{rule.label || rule.eventKey}</div>
                <div className="text-xs text-muted-foreground font-mono">{rule.eventKey}</div>
              </div>
              <Button
                type="button"
                variant={rule.smsEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleRule(rule.eventKey, !rule.smsEnabled)}
              >
                {rule.smsEnabled ? 'فعال' : 'غیرفعال'}
              </Button>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-muted-foreground">قانونی یافت نشد</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>پیامک آزمایشی</CardTitle>
          <CardDescription>نیاز به SMS_ENABLED=true و پیکربندی ارائه‌دهنده دارد</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>شماره موبایل</Label>
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="0912..."
            />
          </div>
          <div className="space-y-2">
            <Label>متن (اختیاری)</Label>
            <Input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="متن آزمایشی"
            />
          </div>
          <Button onClick={sendTest} disabled={testing}>
            <Send className="w-4 h-4 ml-2" />
            {testing ? 'در حال ارسال...' : 'ارسال آزمایشی'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>لاگ تحویل SMS</CardTitle>
          <CardDescription>شماره‌ها به‌صورت ماسک‌شده ذخیره می‌شوند</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>رویداد</TableHead>
                  <TableHead>مقصد</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      رویدادی نیست
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((ev) => (
                    <TableRow key={ev.id}>
                      <TableCell className="font-mono text-xs">{ev.eventKey || '—'}</TableCell>
                      <TableCell>{ev.to}</TableCell>
                      <TableCell>
                        <Badge variant={ev.status === 'SENT' ? 'default' : 'secondary'}>
                          {ev.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatToJalali(ev.createdAt, 'YYYY/MM/DD HH:mm')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
