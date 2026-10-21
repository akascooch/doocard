import * as fs from 'fs'
import * as path from 'path'
import { renderToStaticMarkup } from 'react-dom/server'

jest.mock('next/navigation', () => ({ usePathname: () => '/dashboard/admin' }))
jest.mock('next-themes', () => ({ useTheme: () => ({ resolvedTheme: 'light', setTheme: jest.fn() }) }))
jest.mock('next/link', () => {
  const { createElement } = jest.requireActual('react')
  return {
    __esModule: true,
    default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
      createElement('a', { href, ...rest }, children),
  }
})
jest.mock('../LogoutButton', () => ({ LogoutButton: () => null }))
jest.mock('@/components/common/AppLogo', () => ({ AppLogo: () => null }))

import { RoleBasedSidebar } from '../RoleBasedSidebar'

const LOTTERY = 'قرعه‌کشی'

describe('RoleBasedSidebar lottery placeholder (#5)', () => {
  it('ADMIN sees a disabled, non-link "coming soon" item', () => {
    const html = renderToStaticMarkup(<RoleBasedSidebar userRole="ADMIN" />)
    const start = html.indexOf('data-cy="nav-soon-lottery"')
    expect(start).toBeGreaterThan(-1)
    const tagStart = html.lastIndexOf('<', start)
    const item = html.slice(tagStart, html.indexOf('</div></div></div>', start))
    expect(item.startsWith('<div')).toBe(true)
    expect(item).toContain('aria-disabled="true"')
    expect(item).toContain('cursor-not-allowed')
    expect(item).toContain(LOTTERY)
    expect(item).toContain('به‌زودی')
    expect(item).not.toContain('href=')
    expect(html).not.toMatch(/href="[^"]*(lottery|raffle)[^"]*"/i)
  })

  it.each(['ACCOUNTANT', 'EMPLOYEE', 'SERVICE', 'CUSTOMER'])('%s does not see the item', (role) => {
    const html = renderToStaticMarkup(<RoleBasedSidebar userRole={role} />)
    expect(html).not.toContain(LOTTERY)
    expect(html).not.toContain('nav-soon-lottery')
  })

  it('no lottery route exists for it to depend on', () => {
    const appDir = path.join(__dirname, '../../app')
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (/lottery|raffle/i.test(entry.name)) hits.push(path.join(dir, entry.name))
        if (entry.isDirectory()) walk(path.join(dir, entry.name))
      }
    }
    walk(appDir)
    expect(hits).toEqual([])
  })
})
