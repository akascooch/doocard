/** Roles assignable by admin in user management UI (matches Prisma UserRole subset). */
export type AdminAssignableRole = 'ADMIN' | 'EMPLOYEE' | 'SERVICE' | 'CUSTOMER'

export const ADMIN_USER_ROLE_OPTIONS: { value: AdminAssignableRole; label: string }[] = [
  { value: 'CUSTOMER', label: 'مشتری' },
  { value: 'EMPLOYEE', label: 'آرایشگر' },
  { value: 'SERVICE', label: 'پرسنل خدمات' },
  { value: 'ADMIN', label: 'مدیر' },
]

export function getUserRoleLabel(role: string): string {
  const found = ADMIN_USER_ROLE_OPTIONS.find((r) => r.value === role)
  if (found) return found.label
  if (role === 'ACCOUNTANT') return 'حسابدار'
  if (role === 'MANAGER') return 'مدیر سالن'
  return role
}

export function isAdminAssignableRole(value: string): value is AdminAssignableRole {
  return ADMIN_USER_ROLE_OPTIONS.some((role) => role.value === value)
}
