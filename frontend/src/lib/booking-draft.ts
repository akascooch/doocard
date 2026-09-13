const KEY = "doocard-booking-draft"

export type BookingDraft = {
  serviceId?: string
  employeeId?: string
  appointmentDate?: string
  appointmentTime?: string
  customerName?: string
  customerPhone?: string
  step?: number
}

export function readBookingDraft(): BookingDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BookingDraft
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

export function writeBookingDraft(draft: BookingDraft): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // private mode / quota
  }
}

export function clearBookingDraft(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

export function hasBookingDraft(): boolean {
  const draft = readBookingDraft()
  if (!draft) return false
  return Boolean(
    draft.serviceId ||
      draft.employeeId ||
      draft.appointmentDate ||
      draft.appointmentTime,
  )
}

export function resolveCustomerPostAuthHref(role?: string | null): string {
  if (role && role !== "CUSTOMER") {
    return "/dashboard"
  }
  if (hasBookingDraft()) {
    return "/book-appointment"
  }
  return "/dashboard/customer"
}
