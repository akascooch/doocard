/** Matches GET /api/employees list item (EmployeeListItemDto). */
export interface EmployeeListItem {
  id: number
  userId: number
  name: string
  phone: string
  email?: string | null
  specialty?: string | null
  baseSalary: number
  commissionRate: number
  isDefault?: boolean
  isActive: boolean
  status: 'active' | 'inactive'
  services: Array<{
    id: number
    name: string
    description?: string | null
    price: number
    durationMinutes?: number
  }>
  user: {
    id: number
    name: string
    phone: string
    email?: string | null
  }
  employeeServices?: Array<{
    id: number
    serviceId: number
    service: { id: number; name: string; price?: number } | null
  }>
}

export function getEmployeeDisplayName(
  employee: Pick<EmployeeListItem, 'id' | 'name' | 'user'> | null | undefined,
): string {
  if (!employee) return ''
  return employee.name || employee.user?.name || `کارمند #${employee.id}`
}

export function normalizeEmployeeList(data: unknown): EmployeeListItem[] {
  if (!Array.isArray(data)) return []

  return data
    .map((row): EmployeeListItem | null => {
      if (!row || typeof row !== 'object') return null
      const raw = row as Partial<EmployeeListItem> & { user?: EmployeeListItem['user'] }
      if (typeof raw.id !== 'number') return null

      const name =
        typeof raw.name === 'string' && raw.name.trim().length > 0
          ? raw.name.trim()
          : raw.user?.name?.trim()
      if (!name) return null

      const phone = raw.phone || raw.user?.phone || ''
      const user = raw.user ?? {
        id: raw.userId ?? raw.id,
        name,
        phone,
        email: raw.email ?? null,
      }

      return {
        id: raw.id,
        userId: raw.userId ?? user.id,
        name,
        phone,
        email: raw.email ?? user.email ?? null,
        specialty: raw.specialty ?? null,
        baseSalary: raw.baseSalary ?? 0,
        commissionRate: raw.commissionRate ?? 0,
        isDefault: raw.isDefault ?? false,
        isActive: raw.isActive ?? true,
        status: raw.status ?? (raw.isActive === false ? 'inactive' : 'active'),
        services: Array.isArray(raw.services) ? raw.services : [],
        user,
        employeeServices: raw.employeeServices,
      }
    })
    .filter((item): item is EmployeeListItem => item !== null)
}
