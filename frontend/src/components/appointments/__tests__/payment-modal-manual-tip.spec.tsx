/**
 * SSR contract for the settlement modal's two tip flows.
 * - Normal tip (SERVICE staff) is fed by /employees/service-staff/active.
 * - Manual tip is fed by /employees/tip-recipients/manual and only rendered when manualTipAmount > 0.
 * No DOM runner exists in this repo: state is seeded via a test-only useState wrapper
 * (matched by initial-value kind + occurrence) and effects can be run eagerly to capture requests.
 */
import { renderToStaticMarkup } from 'react-dom/server'

type Kind = 'null' | 'array' | 'other'
let mockSeed: ((initial: unknown, kind: Kind, occurrence: number) => unknown) | null = null
let mockRunEffects = false
const mockEffects: Array<() => void> = []
const mockCounters: Record<Kind, number> = { null: 0, array: 0, other: 0 }

jest.mock('react', () => {
  const actual = jest.requireActual('react')
  return {
    ...actual,
    useState: (initial: unknown) => {
      const value = typeof initial === 'function' ? (initial as () => unknown)() : initial
      if (!mockSeed) return actual.useState(value)
      const kind: Kind = value === null ? 'null' : Array.isArray(value) ? 'array' : 'other'
      mockCounters[kind] += 1
      return actual.useState(mockSeed(value, kind, mockCounters[kind]))
    },
    useEffect: (effect: () => void) => {
      if (mockRunEffects) mockEffects.push(effect)
    },
  }
})

jest.mock('@/lib/axios', () => ({ api: { get: jest.fn(), post: jest.fn() } }))
jest.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }))
jest.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 1, role: 'ADMIN' }) }))
jest.mock('@/lib/date', () => ({ formatToJalali: () => '1405/07/28' }))
jest.mock('@/lib/appointment', () => ({
  getAppointmentServices: (a: { services?: unknown[] }) => a?.services ?? [],
  isTipRecipientType: () => true,
}))
jest.mock('@/lib/offline/sync-worker', () => ({
  shouldUseOfflineQueue: jest.fn().mockResolvedValue(false),
  queueAppointmentSettle: jest.fn(),
}))
jest.mock('@/lib/offline/feature-flag', () => ({ isOfflineModeEnabled: () => false }))
jest.mock('@/lib/offline/reference-cache', () => ({
  cacheFromResponse: jest.fn(),
  getReferenceCache: jest.fn(),
  REFERENCE_KEYS: { accounts: 'accounts' },
}))
jest.mock('@/lib/offline/connectivity', () => ({ checkServerReachability: jest.fn().mockResolvedValue(true) }))
jest.mock('@/components/ui/MoneyInput', () => {
  const { createElement } = jest.requireActual('react')
  return { __esModule: true, default: (p: { label: string }) => createElement('div', { 'data-money': p.label }) }
})
jest.mock('@/components/ui/dialog', () => {
  const { createElement, Fragment } = jest.requireActual('react')
  const pass = ({ children }: { children?: unknown }) => createElement(Fragment, null, children)
  return { Dialog: pass, DialogContent: pass, DialogDescription: pass, DialogHeader: pass, DialogTitle: pass }
})
jest.mock('@/components/ui/select', () => {
  const { createElement } = jest.requireActual('react')
  const pass = ({ children }: { children?: unknown }) => createElement('div', null, children)
  return {
    Select: pass,
    SelectTrigger: pass,
    SelectContent: pass,
    SelectValue: (p: { placeholder?: string }) => createElement('span', null, p.placeholder),
    SelectItem: (p: { value: string; children?: unknown }) =>
      createElement('span', { 'data-item': p.value }, p.children),
  }
})

import { api } from '@/lib/axios'
import PaymentModal, { formatManualTipRecipientLabel } from '../PaymentModal'

const apiGet = api.get as jest.Mock

/** Render, then run the effects React would run after commit. */
function renderWithEffects(ui: React.ReactElement) {
  mockEffects.length = 0
  mockRunEffects = true
  try {
    renderToStaticMarkup(ui)
  } finally {
    mockRunEffects = false
  }
  mockEffects.splice(0).forEach((effect) => effect())
}

const flush = async () => {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setImmediate(resolve))
}

beforeAll(() => {
  if (!(globalThis as { crypto?: unknown }).crypto) {
    ;(globalThis as { crypto?: unknown }).crypto = { randomUUID: () => 'uuid' }
  }
})

describe('PaymentModal data loading', () => {
  beforeEach(() => {
    apiGet.mockReset()
    apiGet.mockImplementation(async (url: string) =>
      url === '/appointments/42'
        ? { data: { id: 42, customerId: 7, employeeId: 3, services: [], status: 'CONFIRMED', customerName: 'C' } }
        : { data: [] },
    )
  })

  it('opening the modal loads manual recipients once from the dedicated endpoint (not /employees)', async () => {
    renderWithEffects(<PaymentModal appointmentId={42} isOpen onClose={() => undefined} />)
    await flush()

    const urls = apiGet.mock.calls.map((c) => c[0])
    expect(urls.filter((u) => u === '/employees/tip-recipients/manual')).toHaveLength(1)
    expect(urls.filter((u) => u === '/employees/service-staff/active')).toHaveLength(1)
    expect(urls).not.toContain('/employees')
  })

  it('a closed modal makes no requests', async () => {
    renderWithEffects(<PaymentModal appointmentId={42} isOpen={false} onClose={() => undefined} />)
    await flush()
    expect(apiGet).not.toHaveBeenCalled()
  })
})

describe('PaymentModal tip selects', () => {
  function render(manualTipAmount: number) {
    mockCounters.null = 0
    mockCounters.array = 0
    mockCounters.other = 0
    mockSeed = (initial, kind, n) => {
      if (kind === 'null' && n === 1) {
        return { id: 42, customerId: 7, employeeId: 3, services: [], status: 'CONFIRMED', customerName: 'C' }
      }
      if (initial && typeof initial === 'object' && 'manualTipAmount' in (initial as object)) {
        return {
          ...(initial as object),
          amount: 100_000,
          paidAmount: 100_000,
          tipAmount: 50_000,
          tipRecipientType: 'INDIVIDUAL',
          manualTipAmount,
        }
      }
      if (kind === 'array' && n === 2) return [{ id: 9, name: 'S-Staff' }] // serviceStaff
      if (kind === 'array' && n === 3) return [{ id: 3, name: 'H-Manual' }] // manual recipients
      return initial
    }
    try {
      return renderToStaticMarkup(<PaymentModal appointmentId={42} isOpen onClose={() => undefined} />)
    } finally {
      mockSeed = null
    }
  }

  const between = (html: string, from: string, to?: string) => {
    const start = html.indexOf(from)
    expect(start).toBeGreaterThanOrEqual(0)
    const end = to ? html.indexOf(to, start) : -1
    return html.slice(start, end > start ? end : undefined)
  }

  it('manual tip select lists only manual recipients; normal tip select lists only SERVICE staff', () => {
    const html = render(30_000)
    expect(html).toContain('انعام دستی (جدا از انعام پرسنل خدمات)')
    const manual = between(html, 'گیرنده انعام دستی', 'نوع گیرنده انعام')
    expect(manual).toContain('H-Manual')
    expect(manual).not.toContain('S-Staff')
    const normal = between(html, 'پرسنل خدمات گیرنده')
    expect(normal).toContain('S-Staff')
    expect(normal).not.toContain('H-Manual')
  })

  it('manual recipient select is not rendered while manualTipAmount is 0', () => {
    const html = render(0)
    expect(html).not.toContain('گیرنده انعام دستی')
    expect(html).not.toContain('H-Manual')
    expect(html).toContain('S-Staff')
  })

  it('shows a SERVICE role suffix without any env flag', () => {
    expect(formatManualTipRecipientLabel({ id: 2, fullName: 'سارا', role: 'SERVICE' })).toBe(
      'سارا (پرسنل خدمات)',
    )
    expect(formatManualTipRecipientLabel({ id: 3, fullName: 'علی', role: 'EMPLOYEE' })).toBe(
      'علی (آرایشگر)',
    )
  })
})
