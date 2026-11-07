'use client'

import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getApiErrorMessage, notifyError } from '@/lib/notify'
import api from '@/lib/axios'
import { Gift, Search } from 'lucide-react'

type CustomerHit = { id: number; user?: { name?: string; phone?: string } }
type OwnedPackage = {
  id: string
  title: string | null
  serviceName: string | null
  serviceNames?: string[]
  totalSessions: number
  remainingSessions: number
  unlimited?: boolean
  status: string
  expiresAt: string
}
type Holder = {
  customerId: number
  name: string | null
  phone: string | null
  packages: OwnedPackage[]
}
type HistoryRow = {
  id: string
  packageTitle: string | null
  appointmentId: number
  appointmentStatus: string
  serviceName: string | null
  consumedAt: string
  unlimited: boolean
  remainingSessions: number
  totalSessions: number
}

function sessionsLabel(pkg: OwnedPackage) {
  if (pkg.unlimited || pkg.totalSessions === 0) return 'نامحدود'
  return `${pkg.remainingSessions} از ${pkg.totalSessions} جلسه`
}

export default function EmployeePackagesPage() {
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [holders, setHolders] = useState<Holder[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<CustomerHit | null>(null)
  const [items, setItems] = useState<OwnedPackage[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const pageSize = 20

  const loadHolders = useCallback(async (nextPage: number) => {
    setListLoading(true)
    try {
      const res = await api.get('/packages/visible-active', {
        params: { page: nextPage, pageSize },
      })
      setHolders((res.data.items || []) as Holder[])
      setTotal(Number(res.data.total) || 0)
      setPage(Number(res.data.page) || nextPage)
    } catch (error) {
      setHolders([])
      notifyError('پکیج', getApiErrorMessage(error, 'بارگذاری دارندگان پکیج ناموفق بود'))
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHolders(1)
  }, [loadHolders])

  const runSearch = async () => {
    const q = search.trim()
    if (q.length < 2) return
    try {
      const res = await api.get('/customers', { params: { search: q } })
      setHits(Array.isArray(res.data) ? res.data : [])
    } catch (error) {
      notifyError('جستجو', getApiErrorMessage(error, 'جستجوی مشتری ناموفق بود'))
    }
  }

  const pick = async (row: CustomerHit) => {
    setSelected(row)
    setLoading(true)
    try {
      const [packagesRes, historyRes] = await Promise.all([
        api.get('/packages/assigned', { params: { customerId: row.id } }),
        api.get('/packages/visible-history', { params: { customerId: row.id } }),
      ])
      setItems((packagesRes.data.items || []) as OwnedPackage[])
      setHistory((historyRes.data.items || []) as HistoryRow[])
    } catch (error) {
      setItems([])
      setHistory([])
      notifyError('پکیج', getApiErrorMessage(error, 'بارگذاری پکیج‌ها ناموفق بود'))
    } finally {
      setLoading(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6" />
          پکیج‌های مشتری
        </h1>
        <p className="text-muted-foreground mt-1">
          فقط مشتریانی که طبق دسترسی شما پکیج فعال دارند. ایجاد قالب و حذف در این صفحه نیست.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>دارندگان پکیج فعال</CardTitle>
          <CardDescription>
            فهرست اولیه بدون جستجو. پکیج نامحدود با مانده صفر همچنان فعال است.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {listLoading ? (
            <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
          ) : holders.length === 0 ? (
            <p className="text-sm text-muted-foreground">پکیج فعالی در محدوده دسترسی شما نیست.</p>
          ) : (
            holders.map((holder) => (
              <button
                key={holder.customerId}
                type="button"
                className="block w-full rounded border px-3 py-2 text-right text-sm hover:bg-muted"
                onClick={() =>
                  void pick({
                    id: holder.customerId,
                    user: { name: holder.name || undefined, phone: holder.phone || undefined },
                  })
                }
              >
                <span className="font-medium">{holder.name || `مشتری #${holder.customerId}`}</span>
                <span className="text-muted-foreground"> — {holder.phone || 'بدون موبایل'}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {holder.packages.map((pkg) => `${pkg.title || 'پکیج'}: ${sessionsLabel(pkg)}`).join(' | ')}
                </span>
              </button>
            ))
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {total.toLocaleString('fa-IR')} مشتری
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || listLoading}
                onClick={() => void loadHolders(page - 1)}
              >
                قبلی
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pageCount || listLoading}
                onClick={() => void loadHolders(page + 1)}
              >
                بعدی
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>جستجوی مشتری</CardTitle>
          <CardDescription>نام یا شماره موبایل را وارد کنید. نتیجه همان محدوده دسترسی شماست.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جستجو..." />
            <Button type="button" variant="outline" onClick={() => void runSearch()}>
              <Search className="h-4 w-4 ml-1" />
              جستجو
            </Button>
          </div>
          {hits.map((row) => (
            <button
              key={row.id}
              type="button"
              className="block w-full rounded border px-3 py-2 text-right text-sm hover:bg-muted"
              onClick={() => void pick(row)}
            >
              {row.user?.name || `مشتری #${row.id}`} — {row.user?.phone || 'بدون موبایل'}
            </button>
          ))}
        </CardContent>
      </Card>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>پکیج‌های {selected.user?.name || selected.id}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">پکیجی یافت نشد.</p>
            ) : (
              items.map((pkg) => (
                <div key={pkg.id} className="rounded border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{pkg.title || 'پکیج'}</p>
                    <Badge variant="outline">{pkg.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {(pkg.serviceNames?.length ? pkg.serviceNames.join('، ') : pkg.serviceName) || 'خدمت نامشخص'}
                  </p>
                  <p className="text-sm mt-1">{sessionsLabel(pkg)}</p>
                </div>
              ))
            )}
            <div>
              <p className="font-medium mb-2">تاریخچه مصرف</p>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">مصرف ثبت‌شده‌ای برای نوبت‌های معتبر نیست.</p>
              ) : (
                history.map((row) => (
                  <div key={row.id} className="rounded border px-3 py-2 text-sm mb-2">
                    <p>{row.packageTitle || 'پکیج'} — نوبت #{row.appointmentId}</p>
                    <p className="text-muted-foreground">
                      {row.serviceName || 'خدمت'} · {row.appointmentStatus} ·{' '}
                      {row.unlimited ? 'نامحدود' : `${row.remainingSessions} از ${row.totalSessions}`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
