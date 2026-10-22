export const EXPENSE_OTHER_SERIES_LABEL = 'سایر (جمع‌شده)'
export const CLEARED_CHEQUE_SERIES_LABEL = 'چک وصول‌شده'
export const UNCATEGORIZED_EXPENSE_LABEL = 'بدون دسته‌بندی'

export type ExpenseMonthInput = {
  month: string
  expense: {
    total: string
    cheques?: string
    categories: Array<{ name: string; total: string; categoryId?: number | null }>
  }
}

export type ExpenseSeriesKey = {
  key: string
  name: string
  categoryId?: number | null
  kind: 'category' | 'uncategorized' | 'rest' | 'cheque'
}

export type ExpenseCategoryRow = {
  month: string
  total: number
  cheques: number
  categories: Array<{ name: string; total: number; categoryId: number | null }>
} & Record<string, number | string | Array<{ name: string; total: number; categoryId: number | null }>>

/**
 * Stacked-bar data: چک وصول‌شده is a first-class series (not ranked in top N).
 * Remaining named buckets (including بدون دسته‌بندی) take top N; overflow → سایر (جمع‌شده).
 * Palette budget is 7: up to 5 named + rest + cheque.
 */
export function buildExpenseCategorySeries(
  months: ExpenseMonthInput[],
  topN = 5,
): { series: ExpenseSeriesKey[]; rows: ExpenseCategoryRow[] } {
  const yearly = new Map<string, { total: number; categoryId: number | null }>()
  for (const m of months) {
    for (const c of m.expense.categories ?? []) {
      if (c.name === CLEARED_CHEQUE_SERIES_LABEL) continue
      const prev = yearly.get(c.name)
      const add = Number(c.total)
      if (prev) {
        prev.total += add
      } else {
        yearly.set(c.name, {
          total: add,
          categoryId: c.categoryId ?? (c.name === UNCATEGORIZED_EXPENSE_LABEL ? null : c.categoryId ?? null),
        })
      }
    }
  }

  const ranked = Array.from(yearly.entries())
    .filter(([, row]) => row.total > 0)
    .sort((a, b) => b[1].total - a[1].total)
  const top = ranked.slice(0, topN)
  const hasRest = ranked.length > top.length

  const series: ExpenseSeriesKey[] = top.map(([name, row], i) => ({
    key: `c${i}`,
    name,
    categoryId: row.categoryId,
    kind: name === UNCATEGORIZED_EXPENSE_LABEL ? 'uncategorized' : 'category',
  }))
  if (hasRest) {
    series.push({ key: 'rest', name: EXPENSE_OTHER_SERIES_LABEL, kind: 'rest' })
  }
  series.push({
    key: 'cheques',
    name: CLEARED_CHEQUE_SERIES_LABEL,
    kind: 'cheque',
  })

  const keyByName = new Map(series.filter((s) => s.key !== 'rest' && s.key !== 'cheques').map((s) => [s.name, s.key]))

  const rows = months.map((m) => {
    const cheques = Number(m.expense.cheques ?? 0)
    const row: ExpenseCategoryRow = {
      month: m.month,
      total: Number(m.expense.total),
      cheques,
      categories: (m.expense.categories ?? [])
        .filter((c) => c.name !== CLEARED_CHEQUE_SERIES_LABEL)
        .map((c) => ({
          name: c.name,
          total: Number(c.total),
          categoryId: c.categoryId ?? null,
        }))
        .sort((a, b) => b.total - a.total),
    }
    for (const s of series) row[s.key] = 0
    row.cheques = cheques
    for (const c of row.categories) {
      const key = keyByName.get(c.name) ?? (hasRest ? 'rest' : undefined)
      if (key) row[key] = (row[key] as number) + c.total
    }
    return row
  })

  return { series, rows }
}
