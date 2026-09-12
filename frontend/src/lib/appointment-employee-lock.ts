export type LockableEmployee = {
  id: number
  userId?: number
  user?: { id?: number } | null
}

export function employeeUiIsLocked(role: string | undefined | null): boolean {
  return role === 'EMPLOYEE'
}

export function findEmployeeIdForUser(
  employees: LockableEmployee[],
  actorUserId: number | undefined,
): number | null {
  if (!actorUserId || !Number.isInteger(actorUserId) || actorUserId < 1) return null
  const match = employees.find(
    (employee) => employee.userId === actorUserId || employee.user?.id === actorUserId,
  )
  return match?.id ?? null
}

export function canSelectEmployeeInUi(
  role: string | undefined | null,
  candidateEmployeeId: number,
  lockedEmployeeId: number | null,
): boolean {
  if (!employeeUiIsLocked(role)) return true
  if (lockedEmployeeId == null) return false
  return candidateEmployeeId === lockedEmployeeId
}
