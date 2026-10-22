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

const LOTTERY = 'صندوق همکاران'

describe('RoleBasedSidebar lottery routes', () => {
  it('ADMIN gets a real admin lottery link, not coming-soon', () => {
    const html = renderToStaticMarkup(<RoleBasedSidebar userRole="ADMIN" />)
    expect(html).toContain(LOTTERY)
    expect(html).toContain('href="/dashboard/admin/lottery"')
    expect(html).not.toContain('nav-soon-lottery')
  })

  it('ACCOUNTANT can open the admin lottery page', () => {
    const html = renderToStaticMarkup(<RoleBasedSidebar userRole="ACCOUNTANT" />)
    expect(html).toContain('href="/dashboard/admin/lottery"')
  })

  it.each(['EMPLOYEE', 'SERVICE'])('%s sees the staff lottery route', (role) => {
    const html = renderToStaticMarkup(<RoleBasedSidebar userRole={role} />)
    expect(html).toContain('href="/dashboard/employee/lottery"')
  })

  it('CUSTOMER does not see lottery', () => {
    const html = renderToStaticMarkup(<RoleBasedSidebar userRole="CUSTOMER" />)
    expect(html).not.toContain(LOTTERY)
  })
})
