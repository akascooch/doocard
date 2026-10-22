'use client'

import { useCallback, useEffect, useState } from 'react'
import axios from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { formatTomansFromRial } from '@/lib/money'

type Group = { id: number; name: string; monthlyAmountRial?: string; cronDayOfMonth?: number }
type MemberOpt = { id: number; fullName: string; role: string }
type GroupDetail = {
  id: number
  name: string
  monthlyAmountRial: string
  cronDayOfMonth: number
  circleAccountId: number
  members: Array<{ id: number; employeeId: number; fullName: string; role: string; status: string; prepaidRial: string }>
  cycles: Array<{ id: number; cycleIndex: number; status: string; slots: Array<{ slotIndex: number; periodKey: string; memberId: number }> }>
  arrears: Array<{ memberId: number; periodKey: string; amountRial: string; status: string }>
}

export default function AdminLotteryPage() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<Group[]>([])
  const [selected, setSelected] = useState<GroupDetail | null>(null)
  const [options, setOptions] = useState<MemberOpt[]>([])
  const [accounts, setAccounts] = useState<Array<{ id: number; name: string; isCircleAccount?: boolean }>>([])
  const [name, setName] = useState('صندوق همکاران')
  const [monthlyToman, setMonthlyToman] = useState('1000000')
  const [cronDay, setCronDay] = useState('1')
  const [circleAccountId, setCircleAccountId] = useState('')
  const [picked, setPicked] = useState<number[]>([])
  const [prepaidMemberId, setPrepaidMemberId] = useState('')
  const [prepaidToman, setPrepaidToman] = useState('')
  const [dry, setDry] = useState<unknown>(null)

  const load = useCallback(async () => {
    const [g, o, a] = await Promise.all([
      axios.get('/admin/lottery/groups'),
      axios.get('/admin/lottery/employee-options'),
      axios.get('/accounting/accounts').catch(() => ({ data: [] })),
    ])
    setGroups(g.data)
    setOptions(o.data)
    setAccounts(a.data || [])
  }, [])

  useEffect(() => {
    void load().catch(() => toast({ title: 'خطا', description: 'بارگذاری صندوق انجام نشد', variant: 'destructive' }))
  }, [load, toast])

  const openGroup = async (id: number) => {
    const res = await axios.get(`/admin/lottery/groups/${id}`)
    setSelected(res.data)
    setPicked(res.data.members.filter((m: { status: string }) => m.status === 'ACTIVE').map((m: { employeeId: number }) => m.employeeId))
  }

  const create = async () => {
    const circle = Number(circleAccountId)
    await axios.post('/admin/lottery/groups', {
      name,
      monthlyAmountRial: String(Number(monthlyToman) * 10),
      cronDayOfMonth: Number(cronDay),
      circleAccountId: circle,
    })
    toast({ title: 'گروه ساخته شد' })
    await load()
  }

  const saveMembers = async () => {
    if (!selected) return
    await axios.put(`/admin/lottery/groups/${selected.id}/members`, { employeeIds: picked })
    await openGroup(selected.id)
  }

  const startCycle = async () => {
    if (!selected) return
    await axios.post(`/admin/lottery/groups/${selected.id}/cycles`)
    await openGroup(selected.id)
  }

  const dryRun = async () => {
    if (!selected) return
    const res = await axios.post(`/admin/lottery/groups/${selected.id}/cron/dry-run`)
    setDry(res.data)
  }

  const prepaid = async () => {
    if (!selected || !prepaidMemberId) return
    await axios.post(`/admin/lottery/members/${prepaidMemberId}/prepaid`, {
      amountRial: String(Number(prepaidToman) * 10),
      circleAccountId: selected.circleAccountId,
      note: 'شارژ دستی ادمین',
    })
    await openGroup(selected.id)
  }

  const circleAccounts = accounts.filter((a) => a.isCircleAccount && a.name !== 'حساب صندوق')

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-2xl font-bold">صندوق قرعه‌کشی همکاران</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ترتیب از دوره قبل قفل است: دو نفر آخر دوره قبلی، در صورت عضویت، نفرات اول این دوره هستند.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>گروه جدید</CardTitle>
          <CardDescription>شارژ پیش‌پرداخت فقط از همین صفحه است؛ اتصال به تسویه حقوق در v1.1.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>نام</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>قسط ماهانه (تومان)</Label>
            <Input value={monthlyToman} onChange={(e) => setMonthlyToman(e.target.value)} />
          </div>
          <div>
            <Label>روز کرون (۱–۲۸)</Label>
            <Input value={cronDay} onChange={(e) => setCronDay(e.target.value)} />
          </div>
          <div>
            <Label>حساب دایره</Label>
            <select
              className="w-full border rounded-md h-10 px-2"
              value={circleAccountId}
              onChange={(e) => setCircleAccountId(e.target.value)}
            >
              <option value="">انتخاب حساب</option>
              {circleAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => void create()}>ایجاد گروه</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {groups.map((g) => (
          <Button key={g.id} variant="outline" onClick={() => void openGroup(g.id)}>
            {g.name}
          </Button>
        ))}
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>{selected.name}</CardTitle>
            <CardDescription>
              قسط {formatTomansFromRial(selected.monthlyAmountRial)} — روز کرون {selected.cronDayOfMonth}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm font-medium">اعضا (آرایشگر و خدمات)</p>
            <div className="grid gap-2 max-h-48 overflow-y-auto">
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
            <Button variant="secondary" onClick={() => void startCycle()}>
              شروع دوره جدید
            </Button>

            <p className="text-sm font-medium">صف (فقط خواندنی)</p>
            <ol className="text-sm space-y-1">
              {(selected.cycles[0]?.slots ?? []).map((s) => (
                <li key={s.slotIndex}>
                  {s.slotIndex}. {s.periodKey}
                </li>
              ))}
            </ol>

            <p className="text-sm font-medium">معوقات</p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-right">عضو</th>
                  <th className="text-right">ماه</th>
                  <th className="text-right">مانده</th>
                  <th className="text-right">وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {selected.arrears.map((a, i) => (
                  <tr key={i}>
                    <td>{a.memberId}</td>
                    <td>{a.periodKey}</td>
                    <td>{formatTomansFromRial(a.amountRial)}</td>
                    <td>{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid gap-2 sm:grid-cols-3">
              <select
                className="border rounded-md h-10 px-2"
                value={prepaidMemberId}
                onChange={(e) => setPrepaidMemberId(e.target.value)}
              >
                <option value="">عضو برای شارژ</option>
                {selected.members
                  .filter((m) => m.status === 'ACTIVE')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName}
                    </option>
                  ))}
              </select>
              <Input placeholder="مبلغ تومان" value={prepaidToman} onChange={(e) => setPrepaidToman(e.target.value)} />
              <Button onClick={() => void prepaid()}>شارژ پیش‌پرداخت</Button>
            </div>
            <Button variant="outline" onClick={() => void dryRun()}>
              پیش‌نمایش خشک کرون
            </Button>
            {dry ? <pre className="text-xs overflow-x-auto bg-muted p-3 rounded">{JSON.stringify(dry, null, 2)}</pre> : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
