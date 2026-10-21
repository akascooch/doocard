/**
 * SSR contract for the admin per-service barber UI. The repo has no DOM test runner, so
 * initial state is seeded through a test-only useState wrapper (matched by initial value),
 * and the heavy pickers are stubbed to expose their props in markup.
 */
import { renderToStaticMarkup } from 'react-dom/server'

let mockSeed: ((initial: unknown, emptyObjectIndex: number) => unknown) | null = null

jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    useState: (initial: unknown) => {
      const value = typeof initial === 'function' ? (initial as () => unknown)() : initial
      if (!mockSeed) return actual.useState(value)
      const isEmptyObject =
        value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0
      const counter = (globalThis as { __emptyObjSeen?: number })
      const idx = isEmptyObject ? (counter.__emptyObjSeen = (counter.__emptyObjSeen ?? 0) + 1) : 0
      return actual.useState(mockSeed(value, idx))
    },
  }
})

jest.mock('@/lib/date', () => ({
  getTehranTodayJalali: () => '1405/07/28',
  jalaliToApiDate: (v: string) => v,
  tehranHHmmFromIso: () => '10:00',
}))
jest.mock('@/lib/axios', () => ({ api: { get: jest.fn(), post: jest.fn() } }))
jest.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 1, role: 'ADMIN' }) }))
jest.mock('@/lib/offline/sync-worker', () => ({
  shouldUseOfflineQueue: jest.fn(),
  queueAppointmentCreate: jest.fn(),
}))
jest.mock('@/lib/offline/reference-cache', () => ({
  cacheFromResponse: jest.fn(),
  getReferenceCache: jest.fn(),
  hasMinimumReferenceCache: jest.fn(),
  REFERENCE_KEYS: { services: 'services' },
}))
jest.mock('@/components/ui/PersianDatePicker', () => ({
  __esModule: true,
  default: () => null,
}))
jest.mock('@/components/appointments', () => {
  const { createElement } = jest.requireActual('react')
  return {
    ServicesMultiSelect: () => null,
    CustomerTypeahead: () => null,
    EmployeeSelectFiltered: (p: { selectedServiceIds: number[]; label: string }) =>
      createElement('div', {
        'data-stub': 'employee-select',
        'data-services': JSON.stringify(p.selectedServiceIds),
      }),
    SlotPickerProfessional: (p: { employeeId: number | null; durationMin: number }) =>
      createElement('div', {
        'data-stub': 'slot-picker',
        'data-employee': String(p.employeeId),
        'data-duration': String(p.durationMin),
      }),
  }
})

import AppointmentForm from '../AppointmentForm'

const SERVICES = [
  { id: 1, name: 'Cut', price: 1000, durationMinutes: 30 },
  { id: 2, name: 'Color', price: 2000, durationMinutes: 60 },
]

function render(
  role: 'ADMIN' | 'EMPLOYEE',
  serviceIds: number[],
  lineEmployees: Record<number, number> = {},
) {
  ;(globalThis as { __emptyObjSeen?: number }).__emptyObjSeen = 0
  mockSeed = (initial, emptyObjectIndex) => {
    if (initial === true) return false // loadingServices
    if (Array.isArray(initial)) return SERVICES // services catalog
    if (initial && typeof initial === 'object' && 'serviceIds' in (initial as object)) {
      return { ...(initial as object), serviceIds, customerId: 5, date: '1405/07/28' }
    }
    if (emptyObjectIndex === 2) return lineEmployees // errors=1, lineEmployees=2, groupTimes=3
    return initial
  }
  try {
    return renderToStaticMarkup(<AppointmentForm role={role} />)
  } finally {
    mockSeed = null
  }
}

const stubs = (html: string, kind: string) =>
  Array.from(html.matchAll(new RegExp(`<div data-stub="${kind}"([^>]*)>`, 'g'))).map((m) => m[1])

describe('AppointmentForm per-service barber (ADMIN)', () => {
  it('ADMIN + 2 services renders one barber selector per service', () => {
    const html = render('ADMIN', [1, 2])
    expect(html).toContain('data-cy="per-service-barbers"')
    const selects = stubs(html, 'employee-select')
    expect(selects).toHaveLength(2)
    expect(selects[0]).toContain('data-services="[1]"')
    expect(selects[1]).toContain('data-services="[2]"')
  })

  it('two different barbers -> one time selector per barber row, each with its own duration', () => {
    const html = render('ADMIN', [1, 2], { 1: 10, 2: 11 })
    const pickers = stubs(html, 'slot-picker')
    expect(pickers).toHaveLength(2)
    expect(pickers[0]).toContain('data-employee="10"')
    expect(pickers[0]).toContain('data-duration="30"')
    expect(pickers[1]).toContain('data-employee="11"')
    expect(pickers[1]).toContain('data-duration="60"')
  })

  it('same barber for both services -> a single time selector for the combined duration', () => {
    const html = render('ADMIN', [1, 2], { 1: 10, 2: 10 })
    const pickers = stubs(html, 'slot-picker')
    expect(pickers).toHaveLength(1)
    expect(pickers[0]).toContain('data-employee="10"')
    expect(pickers[0]).toContain('data-duration="90"')
  })

  it('ADMIN + 1 service keeps the legacy single selector and picker', () => {
    const html = render('ADMIN', [1])
    expect(html).not.toContain('per-service-barbers')
    expect(stubs(html, 'employee-select')).toHaveLength(1)
    expect(stubs(html, 'employee-select')[0]).toContain('data-services="[1]"')
    expect(stubs(html, 'slot-picker')).toHaveLength(1)
  })

  it('EMPLOYEE with 2 services never gets the per-service UI', () => {
    const html = render('EMPLOYEE', [1, 2])
    expect(html).not.toContain('per-service-barbers')
    expect(stubs(html, 'employee-select')).toHaveLength(1)
    expect(stubs(html, 'employee-select')[0]).toContain('data-services="[1,2]"')
  })
})
