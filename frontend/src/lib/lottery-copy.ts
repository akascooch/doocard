import { formatTomansFromRial } from '@/lib/money'

export function jalaliYmFromPeriodKey(periodKey: string): { jy: number; jm: string } {
  const [y, m] = periodKey.split('-').map(Number)
  const g = new Date(Date.UTC(y, (m || 1) - 1, 1, 0, 30, 0))
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(g)
  const jy = Number(parts.find((p) => p.type === 'year')?.value)
  const jm = parts.find((p) => p.type === 'month')?.value ?? '01'
  return { jy, jm }
}

export function lotteryContributionCopy(opts: {
  periodKey: string
  cycleIndex: number
  groupName: string
  amountRial: string | number
  arrears?: boolean
}): string {
  const { jy, jm } = jalaliYmFromPeriodKey(opts.periodKey)
  const toman = formatTomansFromRial(opts.amountRial)
  if (opts.arrears) {
    return `قسط معوق ${jy}/${jm} دوره ${opts.cycleIndex} صندوق «${opts.groupName}» — ${toman}`
  }
  return `قسط ${jy}/${jm} دوره ${opts.cycleIndex} صندوق «${opts.groupName}» — ${toman}`
}

export function lotteryPayoutCopy(opts: {
  periodKey: string
  cycleIndex: number
  groupName: string
  amountRial: string | number
}): string {
  const { jy, jm } = jalaliYmFromPeriodKey(opts.periodKey)
  const toman = formatTomansFromRial(opts.amountRial)
  return `پرداخت صندوق «${opts.groupName}» دوره ${opts.cycleIndex} ماه ${jy}/${jm} — ${toman}`
}
