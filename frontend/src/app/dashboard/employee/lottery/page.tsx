'use client'

import { useEffect, useState } from 'react'
import axios from '@/lib/axios'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { lotteryContributionCopy, lotteryPayoutCopy } from '@/lib/lottery-copy'

type Me = {
  group: { id: number; name: string; monthlyAmountRial: string } | null
  cycle?: { id: number; cycleIndex: number; status: string } | null
  mySlot?: { slotIndex: number; periodKey: string } | null
  queue?: Array<{ slotIndex: number; periodKey: string; displayName: string }>
  contributions?: Array<{ periodKey: string; status: string; amountRial: string }>
  arrearsRial?: string
}

export default function StaffLotteryPage() {
  const [data, setData] = useState<Me | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void axios
      .get('/lottery/me')
      .then((res) => setData(res.data))
      .catch((err) => {
        const code = err?.response?.data?.code
        setError(code === 'MULTIPLE_GROUPS_UNSUPPORTED' ? 'عضویت در چند گروه پشتیبانی نمی‌شود' : 'خطا در بارگذاری صندوق')
      })
  }, [])

  if (error) return <p className="p-4 text-destructive">{error}</p>
  if (!data) return <p className="p-4">در حال بارگذاری…</p>
  if (!data.group) return <p className="p-4">شما عضو صندوق فعالی نیستید.</p>

  const cycleIndex = data.cycle?.cycleIndex ?? 1

  return (
    <div className="space-y-4 p-4 max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{data.group.name}</CardTitle>
          <CardDescription>
            نوبت شما: {data.mySlot ? `${data.mySlot.periodKey} (ردیف ${data.mySlot.slotIndex})` : 'هنوز دوره فعال نیست'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm">معوق: {data.arrearsRial ?? '0'} ریال</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اقساط</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(data.contributions ?? []).map((c) => (
            <p key={c.periodKey}>
              {lotteryContributionCopy({
                periodKey: c.periodKey,
                cycleIndex,
                groupName: data.group!.name,
                amountRial: c.amountRial,
                arrears: c.status === 'ARREARS',
              })}
            </p>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>صف برندگان</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {(data.queue ?? []).map((q) => (
            <p key={q.slotIndex}>
              {q.slotIndex}. {q.displayName} — {q.periodKey}
              {data.mySlot?.slotIndex === q.slotIndex
                ? ` — ${lotteryPayoutCopy({
                    periodKey: q.periodKey,
                    cycleIndex,
                    groupName: data.group!.name,
                    amountRial: data.group!.monthlyAmountRial,
                  })}`
                : ''}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
