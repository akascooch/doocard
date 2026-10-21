export const EXPENSE_OTHER_SERIES_LABEL = 'سایر'

export type ExpenseMonthInput = {
  month: string
  expense: {
    total: string
    categories: Array<{ name: string; total: string }>
  }
}

export type ExpenseSeriesKey = { key: string; name: string }

export type ExpenseCategoryRow = {
  month: string
  total: number
  categories: Array<{ name: string; total: number }>
} & Record<string, number | string | Array<{ name: string; total: number }>>

/**
 * Stacked-bar data: top N categories by yearly total get their own series;
 * the rest collapse into one "سایر" series. Per-month stack sum equals the
 * category sum, which the backend computes with the same predicate as total.
 */
export function buildExpenseCategorySeries(
  months: ExpenseMonthInput[],
  topN = 6,
): { series: ExpenseSeriesKey[]; rows: ExpenseCategoryRow[] } {
  const yearly = new Map<string, number>()
  for (const m of months) {
    for (const c of m.expense.categories ?? []) {
      yearly.set(c.name, (yearly.get(c.name) ?? 0) + Number(c.total))
    }
  }

  const ranked = Array.from(yearly.entries())
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1])
  const top = ranked.slice(0, topN).map(([name]) => name)
  const hasRest = ranked.length > top.length

  const series: ExpenseSeriesKey[] = top.map((name, i) => ({ key: `c${i}`, name }))
  if (hasRest) series.push({ key: 'rest', name: EXPENSE_OTHER_SERIES_LABEL })
  const keyByName = new Map(series.filter((s) => s.key !== 'rest').map((s) => [s.name, s.key]))

  const rows = months.map((m) => {
    const row: ExpenseCategoryRow = {
      month: m.month,
      total: Number(m.expense.total),
      categories: (m.expense.categories ?? [])
        .map((c) => ({ name: c.name, total: Number(c.total) }))
        .sort((a, b) => b.total - a.total),
    }
    for (const s of series) row[s.key] = 0
    for (const c of row.categories) {
      const key = keyByName.get(c.name) ?? (hasRest ? 'rest' : undefined)
      if (key) row[key] = (row[key] as number) + c.total
    }
    return row
  })

  return { series, rows }
}
