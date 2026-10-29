'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getApiErrorMessage, notifyError, notifySuccess } from '@/lib/notify'
import { formatNumberWithCommas, formatRials } from '@/lib/money'
import { persianToEnglishDigits, formatToJalali } from '@/lib/date'
import { getCurrentUser } from '@/lib/auth'
import { getDashboardHomePath } from '@/lib/user-roles'
import api from '@/lib/axios'
import { Gift, History, Loader2, Plus, Search } from 'lucide-react'

type Template = {
  id: string
  title: string
  description: string | null
  priceRial: string
  validityDays: number
  totalSessions: number
  unlimited?: boolean
  serviceId: number | null
  serviceIds: number[]
  serviceName: string | null
  serviceNames?: string[]
  isActive: boolean
}

type ServiceRow = { id: number; name: string }
type CustomerHit = { id: number; user?: { name?: string; phone?: string } }
type HistoryRow = {
  id: string
  packageTitle: string | null
  appointmentId: number
  appointmentScheduledAt: string
  serviceName: string | null
  consumedAt: string
  consumedByName: string | null
  remainingSessions: number
  totalSessions: number
  unlimited: boolean
}

const PAYMENTS = [
  { id: 'CASH', label: 'نقد' },
  { id: 'CARD', label: 'کارت' },
  { id: 'WALLET', label: 'کیف پول مشتری' },
  { id: 'COMPLIMENTARY', label: 'هدیه' },
] as const

function sessionsLabel(total: number, remaining?: number) {
  if (total === 0) return 'نامحدود'
  if (remaining == null) return `${total} جلسه`
  return `${remaining} از ${total} جلسه`
}

export default function AdminPackagesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<Template[]>([])
  const [services, setServices] = useState<ServiceRow[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [validityDays, setValidityDays] = useState('90')
  const [totalSessions, setTotalSessions] = useState('5')
  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerHit | null>(null)
  const [assignTemplateId, setAssignTemplateId] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENTS)[number]['id']>('CASH')
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    const currentUser = getCurrentUser()
    if (!currentUser || currentUser.role !== 'ADMIN') {
      window.location.replace(getDashboardHomePath(currentUser?.role))
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tpl, svc] = await Promise.all([api.get('/packages/templates'), api.get('/services')])
      const items = (tpl.data.items || []) as Template[]
      setTemplates(items)
      const svcRows = Array.isArray(svc.data) ? svc.data : svc.data?.items || []
      setServices(svcRows.map((row: ServiceRow) => ({ id: row.id, name: row.name })))
      setAssignTemplateId((current) => current || items.find((i) => i.isActive)?.id || items[0]?.id || '')
    } catch (error) {
      notifyError('پکیج', getApiErrorMessage(error, 'بارگذاری ناموفق بود'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setPrice('')
    setValidityDays('90')
    setTotalSessions('5')
    setServiceIds([])
  }

  const toggleService = (id: number) => {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
    )
  }

  const saveTemplate = async () => {
    const digits = persianToEnglishDigits(price).replace(/[,،\s]/g, '')
    const sessions = Number(persianToEnglishDigits(totalSessions))
    if (!title.trim() || !/^\d+$/.test(digits) || serviceIds.length === 0) return
    if (!Number.isInteger(sessions) || sessions < 0) return
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        priceRial: digits,
        validityDays: Number(validityDays),
        totalSessions: sessions,
        serviceIds,
      }
      if (editingId) {
        await api.patch(`/packages/templates/${editingId}`, payload)
        notifySuccess('پکیج ویرایش شد')
      } else {
        await api.post('/packages/templates', payload)
        notifySuccess('پکیج ایجاد شد')
      }
      resetForm()
      await load()
    } catch (error) {
      notifyError('پکیج', getApiErrorMessage(error, 'ذخیره ناموفق بود'))
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (id: string) => {
    try {
      await api.delete(`/packages/templates/${id}`)
      notifySuccess('پکیج غیرفعال شد')
      await load()
    } catch (error) {
      notifyError('پکیج', getApiErrorMessage(error, 'غیرفعال‌سازی ناموفق بود'))
    }
  }

  const runSearch = async () => {
    const q = search.trim()
    if (q.length < 2) return
    try {
      const res = await api.get('/customers', { params: { search: q } })
      const rows = Array.isArray(res.data) ? res.data : []
      setHits(rows)
    } catch (error) {
      notifyError('جستجو', getApiErrorMessage(error, 'جستجوی مشتری ناموفق بود'))
    }
  }

  const loadHistory = async (customerId: number) => {
    setHistoryLoading(true)
    try {
      const res = await api.get('/packages/history', { params: { customerId } })
      setHistoryRows(res.data.items || [])
    } catch (error) {
      setHistoryRows([])
      notifyError('تاریخچه', getApiErrorMessage(error, 'بارگذاری تاریخچه ناموفق بود'))
    } finally {
      setHistoryLoading(false)
    }
  }

  const pickCustomer = async (row: CustomerHit) => {
    setSelectedCustomer(row)
    await loadHistory(row.id)
  }

  const assign = async () => {
    if (!selectedCustomer || !assignTemplateId) return
    setSaving(true)
    try {
      await api.post('/packages/assign', {
        customerId: selectedCustomer.id,
        packageTemplateId: assignTemplateId,
        paymentMethod,
      })
      notifySuccess('پکیج برای مشتری ثبت شد')
      await loadHistory(selectedCustomer.id)
    } catch (error) {
      notifyError('واگذاری', getApiErrorMessage(error, 'واگذاری ناموفق بود'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Gift className="h-7 w-7" />
          مدیریت پکیج‌ها و طرح‌ها
        </h1>
        <p className="text-muted-foreground mt-1">
          پکیج می‌تواند چند خدمت داشته باشد. مقدار ۰ جلسه یعنی نامحدود. امتیاز وفاداری از این صفحه حذف شده و طبق قانون ثابت نوبت‌ها محاسبه می‌شود.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'ویرایش پکیج' : 'پکیج جدید'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>عنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>خدمات (چندانتخابی)</Label>
            <div className="grid max-h-48 grid-cols-1 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
              {services.map((row) => {
                const checked = serviceIds.includes(row.id)
                return (
                  <label key={row.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleService(row.id)}
                    />
                    {row.name}
                  </label>
                )
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>قیمت (ریال)</Label>
            <Input dir="ltr" value={price} onChange={(e) => setPrice(formatNumberWithCommas(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>تعداد جلسات (۰ = نامحدود)</Label>
            <Input dir="ltr" value={totalSessions} onChange={(e) => setTotalSessions(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>اعتبار (روز)</Label>
            <Input dir="ltr" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>توضیح</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex gap-2">
            <Button type="button" disabled={saving} onClick={() => void saveTemplate()}>
              <Plus className="h-4 w-4 ml-1" />
              {editingId ? 'ذخیره' : 'ایجاد'}
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetForm}>انصراف</Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>قالب‌های پکیج</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {(item.serviceNames?.length ? item.serviceNames.join('، ') : item.serviceName) || 'بدون خدمت'}
                  {' · '}
                  {formatRials(item.priceRial)}
                  {' · '}
                  {sessionsLabel(item.totalSessions)}
                  {' · '}
                  {item.validityDays} روز
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={item.isActive ? 'default' : 'outline'}>
                  {item.isActive ? 'فعال' : 'غیرفعال'}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(item.id)
                    setTitle(item.title)
                    setDescription(item.description || '')
                    setPrice(formatNumberWithCommas(item.priceRial))
                    setValidityDays(String(item.validityDays))
                    setTotalSessions(String(item.totalSessions))
                    setServiceIds(item.serviceIds?.length ? item.serviceIds : item.serviceId ? [item.serviceId] : [])
                  }}
                >
                  ویرایش
                </Button>
                {item.isActive ? (
                  <Button type="button" size="sm" variant="destructive" onClick={() => void deactivate(item.id)}>
                    غیرفعال
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>واگذاری به مشتری و تاریخچه مصرف</CardTitle>
          <CardDescription>پس از انتخاب مشتری، پکیج را واگذار کنید و تاریخچه مصرف را ببینید.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="جستجوی نام یا موبایل مشتری"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="button" variant="outline" onClick={() => void runSearch()}>
              <Search className="h-4 w-4 ml-1" />
              جستجو
            </Button>
          </div>
          {hits.length > 0 ? (
            <div className="space-y-1 rounded-md border p-2">
              {hits.slice(0, 8).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="block w-full rounded px-2 py-1 text-right text-sm hover:bg-muted"
                  onClick={() => void pickCustomer(row)}
                >
                  {row.user?.name || `مشتری #${row.id}`} — {row.user?.phone || 'بدون موبایل'}
                </button>
              ))}
            </div>
          ) : null}

          {selectedCustomer ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="font-medium">
                مشتری انتخاب‌شده: {selectedCustomer.user?.name || selectedCustomer.id}
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>قالب پکیج</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={assignTemplateId}
                    onChange={(e) => setAssignTemplateId(e.target.value)}
                  >
                    {templates.filter((t) => t.isActive).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title} ({sessionsLabel(item.totalSessions)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>روش پرداخت</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as (typeof PAYMENTS)[number]['id'])}
                  >
                    {PAYMENTS.map((row) => (
                      <option key={row.id} value={row.id}>{row.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button type="button" disabled={saving} onClick={() => void assign()}>
                    واگذاری پکیج
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="flex items-center gap-2 font-medium">
                  <History className="h-4 w-4" />
                  تاریخچه مصرف
                </h3>
                {historyLoading ? (
                  <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
                ) : historyRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">مصرفی ثبت نشده است.</p>
                ) : (
                  <div className="space-y-2">
                    {historyRows.map((row) => (
                      <div key={row.id} className="rounded border p-2 text-sm">
                        <p className="font-medium">{row.packageTitle || 'پکیج'}</p>
                        <p className="text-muted-foreground">
                          نوبت #{row.appointmentId}
                          {row.serviceName ? ` · ${row.serviceName}` : ''}
                          {' · '}
                          {formatToJalali(row.consumedAt)}
                          {row.consumedByName ? ` · توسط ${row.consumedByName}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          وضعیت جلسات: {sessionsLabel(row.totalSessions, row.remainingSessions)}
                          {' · '}
                          زمان نوبت: {formatToJalali(row.appointmentScheduledAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
