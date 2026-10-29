import { AppointmentCreatedSource } from '@prisma/client';

export function resolveAppointmentCreatedSource(
  role?: string | null,
): AppointmentCreatedSource {
  switch (role) {
    case 'CUSTOMER':
      return AppointmentCreatedSource.CUSTOMER;
    case 'ADMIN':
      return AppointmentCreatedSource.ADMIN;
    case 'EMPLOYEE':
      return AppointmentCreatedSource.BARBER;
    case 'SERVICE':
    case 'MANAGER':
    case 'ACCOUNTANT':
      return AppointmentCreatedSource.STAFF;
    default:
      return AppointmentCreatedSource.UNKNOWN;
  }
}
