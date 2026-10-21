import {
  buildExpenseCategorySeries,
  EXPENSE_OTHER_SERIES_LABEL,
} from '../expense-category-series'

const months = [
  {
    month: 'فروردین',
    expense: {
      total: '1000',
      categories: [
        { name: 'اجاره', total: '600' },
        { name: 'آب', total: '100' },
        { name: 'بدون دسته‌بندی', total: '300' },
      ],
    },
  },
  {
    month: 'اردیبهشت',
    expense: {
      total: '500',
      categories: [
        { name: 'اجاره', total: '400' },
        { name: 'بیمه', total: '100' },
      ],
    },
  },
  { month: 'خرداد', expense: { total: '0', categories: [] } },
]

describe('buildExpenseCategorySeries', () => {
  it('ranks categories by yearly total and groups the tail into سایر', () => {
    const { series, rows } = buildExpenseCategorySeries(months, 2)

    expect(series.map((s) => s.name)).toEqual(['اجاره', 'بدون دسته‌بندی', EXPENSE_OTHER_SERIES_LABEL])
    expect(rows[0]).toMatchObject({ month: 'فروردین', c0: 600, c1: 300, rest: 100 })
    expect(rows[1]).toMatchObject({ month: 'اردیبهشت', c0: 400, c1: 0, rest: 100 })
  })

  it('keeps each month stack equal to the month total', () => {
    const { series, rows } = buildExpenseCategorySeries(months, 2)
    for (const row of rows) {
      const stacked = series.reduce((sum, s) => sum + (row[s.key] as number), 0)
      expect(stacked).toBe(row.total)
    }
  })

  it('omits the سایر series when every category fits in top N', () => {
    const { series } = buildExpenseCategorySeries(months, 10)
    expect(series.map((s) => s.key)).not.toContain('rest')
    expect(series).toHaveLength(4)
  })

  it('exposes exact per-category totals for the tooltip, largest first', () => {
    const { rows } = buildExpenseCategorySeries(months)
    expect(rows[0].categories).toEqual([
      { name: 'اجاره', total: 600 },
      { name: 'بدون دسته‌بندی', total: 300 },
      { name: 'آب', total: 100 },
    ])
  })
})
