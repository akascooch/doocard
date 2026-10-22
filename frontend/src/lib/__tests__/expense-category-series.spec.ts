import {
  buildExpenseCategorySeries,
  CLEARED_CHEQUE_SERIES_LABEL,
  EXPENSE_OTHER_SERIES_LABEL,
  UNCATEGORIZED_EXPENSE_LABEL,
} from '../expense-category-series'

const months = [
  {
    month: 'فروردین',
    expense: {
      total: '1300',
      cheques: '300',
      categories: [
        { name: 'اجاره', total: '600', categoryId: 3 },
        { name: 'آب', total: '100', categoryId: 4 },
        { name: UNCATEGORIZED_EXPENSE_LABEL, total: '300', categoryId: null },
      ],
    },
  },
  {
    month: 'اردیبهشت',
    expense: {
      total: '500',
      cheques: '0',
      categories: [
        { name: 'اجاره', total: '400', categoryId: 3 },
        { name: 'بیمه', total: '100', categoryId: 5 },
      ],
    },
  },
  { month: 'خرداد', expense: { total: '0', cheques: '0', categories: [] } },
]

describe('buildExpenseCategorySeries', () => {
  it('ranks non-cheque categories and keeps چک وصول‌شده as a first-class series', () => {
    const { series, rows } = buildExpenseCategorySeries(months, 2)

    expect(series.map((s) => s.name)).toEqual([
      'اجاره',
      UNCATEGORIZED_EXPENSE_LABEL,
      EXPENSE_OTHER_SERIES_LABEL,
      CLEARED_CHEQUE_SERIES_LABEL,
    ])
    expect(series[series.length - 1].key).toBe('cheques')
    expect(series.every((s) => s.name !== CLEARED_CHEQUE_SERIES_LABEL || s.kind === 'cheque')).toBe(true)
    expect(rows[0]).toMatchObject({ month: 'فروردین', c0: 600, c1: 300, rest: 100, cheques: 300 })
    expect(rows[1]).toMatchObject({ month: 'اردیبهشت', c0: 400, c1: 0, rest: 100, cheques: 0 })
  })

  it('keeps each month stack equal to the month total', () => {
    const { series, rows } = buildExpenseCategorySeries(months, 2)
    for (const row of rows) {
      const stacked = series.reduce((sum, s) => sum + (row[s.key] as number), 0)
      expect(stacked).toBe(row.total)
    }
  })

  it('does not fold cheque amounts into بدون دسته‌بندی or سایر', () => {
    const { series, rows } = buildExpenseCategorySeries(months, 2)
    const uncategorized = series.find((s) => s.kind === 'uncategorized')
    expect(uncategorized?.name).toBe(UNCATEGORIZED_EXPENSE_LABEL)
    expect(rows[0][uncategorized!.key]).toBe(300)
    expect(rows[0].cheques).toBe(300)
    expect(EXPENSE_OTHER_SERIES_LABEL).toBe('سایر (جمع‌شده)')
  })

  it('caps named series so palette stays at most 7 (5 + rest + cheque)', () => {
    const { series } = buildExpenseCategorySeries(months, 5)
    expect(series.length).toBeLessThanOrEqual(7)
    expect(series.filter((s) => s.kind === 'cheque')).toHaveLength(1)
  })

  it('exposes exact per-category totals for the tooltip, largest first', () => {
    const { rows } = buildExpenseCategorySeries(months)
    expect(rows[0].categories).toEqual([
      { name: 'اجاره', total: 600, categoryId: 3 },
      { name: UNCATEGORIZED_EXPENSE_LABEL, total: 300, categoryId: null },
      { name: 'آب', total: 100, categoryId: 4 },
    ])
  })
})
