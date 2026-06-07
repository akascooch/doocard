interface ServiceSnapshotLike {
  serviceId?: number;
  serviceName?: string;
  durationMin?: number;
  priceAtBooking?: number;
}

/**
 * Flatten nullable appointment relations for safe API consumers.
 * Keeps nested objects intact for backward compatibility.
 */
export function normalizeAppointmentFields(appointment: any) {
  const services = (appointment?.services as ServiceSnapshotLike[] | undefined) ?? [];
  const firstService = services[0];

  const serviceName =
    appointment?.service?.name ?? firstService?.serviceName ?? null;

  const serviceDuration =
    appointment?.service?.durationMinutes ?? firstService?.durationMin ?? null;

  const employeeName = appointment?.employee?.user?.name ?? null;

  return {
    serviceName,
    serviceDuration,
    employeeName,
    appointmentDate: appointment?.scheduledAt ?? null,
  };
}
