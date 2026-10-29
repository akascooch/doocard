'use client'

import { useState } from 'react'
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

function sessionsLabel(pkg: OwnedPackage) {
  if (pkg.unlimited || pkg.totalSessions === 0) return 'نامحدود'
  return `${pkg.remainingSessions} از ${pkg.totalSessions} جلسه`
}

export default function EmployeePackagesPage() {
  const [search, setSearch] = useState('')
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [selected, setSelected] = useState<CustomerHit | null>(null)
  const [items, setItems] = useState<OwnedPackage[]>([])
  const [loading, setLoading] = useState(false)

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
      const res = await api.get('/packages/assigned', { params: { customerId: row.id } })
      setItems((res.data.items || []) as OwnedPackage[])
    } catch (error) {
      setItems([])
      notifyError('پکیج', getApiErrorMessage(error, 'بارگذاری پکیج‌ها ناموفق بود'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6" />
          پکیج‌های مشتری
        </h1>
        <p className="text-muted-foreground mt-1">
          فقط مشاهده وضعیت پکیج فعال. ایجاد قالب، حذف و تاریخچه مدیریتی در دسترس نیست.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>جستجوی مشتری</CardTitle>
          <CardDescription>نام یا شماره موبایل را وارد کنید</CardDescription>
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
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">در حال بارگذاری…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">پکیج فعالی یافت نشد.</p>
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
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
