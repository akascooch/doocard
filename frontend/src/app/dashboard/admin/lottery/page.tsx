'use client'

import { useCallback, useEffect, useState } from 'react'
import axios from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { formatTomansFromRial } from '@/lib/money'
import { getTehranTodayGregorian } from '@/lib/date'

type Group = {
  id: number
  name: string
  monthlyAmountRial?: string
  totalLoanAmountRial?: string | null
  startPeriodYm?: string | null
  circleAccountId?: number | null
  _count?: { members: number }
}

type MemberOpt = { id: number; fullName: string; role: string }

type GroupDetail = {
  id: number
  name: string
  monthlyAmountRial: string
  totalLoanAmountRial: string | null
  startPeriodYm: string | null
  circleAccountId: number | null
  isLoanGroup?: boolean
  members: Array<{
    id: number
    employeeId: number
    fullName: string
    role: string
    status: string
    prepaidRial: string
  }>
  cycles: Array<{
    id: number
    cycleIndex: number
    status: string
    slots: Array<{ slotIndex: number; periodKey: string; memberId: number }>
  }>
  arrears: Array<{ memberId: number; periodKey: string; amountRial: string; status: string }>
}

function currentPeriodYm(): string {
  return getTehranTodayGregorian().slice(0, 7)
}

export default function AdminLotteryPage() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [selected, setSelected] = useState<GroupDetail | null>(null)
  const [options, setOptions] = useState<MemberOpt[]>([])
  const [name, setName] = useState('گروه وام همکاران')
  const [monthlyToman, setMonthlyToman] = useState('1000000')
  const [totalLoanToman, setTotalLoanToman] = useState('10000000')
  const [startPeriodYm, setStartPeriodYm] = useState(currentPeriodYm())
  const [picked, setPicked] = useState<number[]>([])
  const [applyPeriodYm, setApplyPeriodYm] = useState(currentPeriodYm())
  const [applyBusy, setApplyBusy] = useState(false)
  const [applyResult, setApplyResult] = useState<unknown>(null)

  const load = useCallback(async () => {
    const [g, o] = await Promise.all([
      axios.get('/admin/lottery/groups'),
      axios.get('/admin/lottery/employee-options'),
    ])
    setGroups(g.data)
    setOptions(o.data)
  }, [])

  useEffect(() => {
    void load().catch(() =>
      toast({ title: 'خطا', description: 'بارگذاری صندوق/وام انجام نشد', variant: 'destructive' }),
    )
  }, [load, toast])

  const openGroup = async (id: number) => {
    const res = await axios.get(`/admin/lottery/groups/${id}`)
    setSelected(res.data)
    setPicked(
      res.data.members
        .filter((m: { status: string }) => m.status === 'ACTIVE')
        .map((m: { employeeId: number }) => m.employeeId),
    )
    setApplyPeriodYm(res.data.startPeriodYm || currentPeriodYm())
    setApplyResult(null)
  }

  const create = async () => {
    if (picked.length === 0) {
      toast({ title: 'اعضا', description: 'حداقل یک کارمند انتخاب کنید', variant: 'destructive' })
      return
    }
    await axios.post('/admin/lottery/groups', {
      name,
      monthlyAmountRial: String(Number(monthlyToman) * 10),
      totalLoanAmountRial: String(Number(totalLoanToman) * 10),
      startPeriodYm,
      employeeIds: picked,
    })
    toast({ title: 'گروه وام ساخته شد' })
    setPicked([])
    await load()
  }

  const saveMembers = async () => {
    if (!selected) return
    await axios.put(`/admin/lottery/groups/${selected.id}/members`, { employeeIds: picked })
    await openGroup(selected.id)
  }

  const applyInstallment = async () => {
    if (!selected) return
    setApplyBusy(true)
    try {
      const res = await axios.post(`/admin/lottery/groups/${selected.id}/installments/apply`, {
        periodKey: applyPeriodYm,
        confirm: true,
      })
      setApplyResult(res.data)
      toast({
        title: 'قسط اعمال شد',
        description: `${res.data.appliedCount} نفر جدید، ${res.data.alreadyAppliedCount} نفر تکراری`,
      })
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'اعمال قسط ناموفق بود'
      toast({ title: 'خطا', description: String(message), variant: 'destructive' })
    } finally {
      setApplyBusy(false)
    }
  }

  const isLoan = selected?.circleAccountId == null || selected?.isLoanGroup === true

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">صندوق و وام همکاران</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ایجاد گروه‌های مستقل وام کارمندی، انتخاب چند نفر، و اعمال قسط ماهانه با کسر از حقوق قابل‌پرداخت.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>گروه وام جدید</CardTitle>
          <CardDescription>
            مبلغ کل وام و قسط ماهانه به‌ازای هر عضو است. شروع بازپرداخت با ماه میلادی مدنی تهران (YYYY-MM).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>نام گروه</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>قسط ماهانه (تومان)</Label>
            <Input value={monthlyToman} onChange={(e) => setMonthlyToman(e.target.value)} />
          </div>
          <div>
            <Label>مبلغ کل وام (تومان)</Label>
            <Input value={totalLoanToman} onChange={(e) => setTotalLoanToman(e.target.value)} />
          </div>
          <div>
            <Label>ماه شروع بازپرداخت (YYYY-MM)</Label>
            <Input value={startPeriodYm} onChange={(e) => setStartPeriodYm(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label>اعضای گروه</Label>
            <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto rounded border p-2">
              {options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.includes(o.id)}
                    onChange={(e) =>
                      setPicked((prev) =>
                        e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id),
                      )
                    }
                  />
                  {o.fullName} ({o.role === 'SERVICE' ? 'خدمات' : 'آرایشگر'})
                </label>
              ))}
            </div>
          </div>
          <Button onClick={() => void create()}>ایجاد گروه وام</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {groups.map((g) => (
          <Button key={g.id} variant="outline" onClick={() => void openGroup(g.id)}>
            {g.name}
            {g._count?.members != null ? ` — ${g._count.members} نفر` : ''}
            {g.circleAccountId == null ? ' (وام)' : ' (صندوق)'}
          </Button>
        ))}
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>{selected.name}</CardTitle>
            <CardDescription>
              قسط ماهانه {formatTomansFromRial(selected.monthlyAmountRial)}
              {selected.totalLoanAmountRial
                ? ` — کل وام ${formatTomansFromRial(selected.totalLoanAmountRial)}`
                : ''}
              {selected.startPeriodYm ? ` — شروع ${selected.startPeriodYm}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium">اعضا (آرایشگر و خدمات)</p>
            <div className="grid max-h-48 gap-2 overflow-y-auto">
              {options.map((o) => (
                <label key={o.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.includes(o.id)}
                    onChange={(e) =>
                      setPicked((prev) =>
                        e.target.checked ? [...prev, o.id] : prev.filter((id) => id !== o.id),
                      )
                    }
                  />
                  {o.fullName} ({o.role === 'SERVICE' ? 'خدمات' : 'آرایشگر'})
                </label>
              ))}
            </div>
            <Button onClick={() => void saveMembers()}>ذخیره اعضا</Button>

            {isLoan ? (
              <div className="space-y-3 rounded border p-3">
                <p className="text-sm font-medium">اعمال قسط این ماه</p>
                <p className="text-xs text-muted-foreground">
                  با تأیید، برای هر عضو فعال یک تراکنش حسابداری ثبت می‌شود و از پیش‌نمایش حقوق همان دوره کسر
                  می‌گردد. تکرار همان ماه بی‌اثر است.
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <Label>دوره (YYYY-MM)</Label>
                    <Input value={applyPeriodYm} onChange={(e) => setApplyPeriodYm(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button disabled={applyBusy} onClick={() => void applyInstallment()}>
                      {applyBusy ? 'در حال ثبت…' : 'ثبت و کسر قسط این ماه'}
                    </Button>
                  </div>
                </div>
                {applyResult ? (
                  <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
                    {JSON.stringify(applyResult, null, 2)}
                  </pre>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                این گروه هنوز به حالت صندوق/حساب دایره است. گروه‌های جدید وام بدون حساب دایره ساخته می‌شوند.
              </p>
            )}

            <p className="text-sm font-medium">اعضای فعال</p>
            <ul className="text-sm space-y-1">
              {selected.members
                .filter((m) => m.status === 'ACTIVE')
                .map((m) => (
                  <li key={m.id}>
                    {m.fullName} — {m.role === 'SERVICE' ? 'خدمات' : 'آرایشگر'}
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
