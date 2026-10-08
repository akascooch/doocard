export type ExtraBookingLine = {
  serviceId: string;
  employeeId: string;
  time?: string;
};

/**
 * Single service keeps the legacy one-appointment body.
 * Extra lines become one appointment per service+barber. Prices are omitted;
 * the server prices each appointment from the rial service catalog.
 */
export function buildAppointmentCreateBody(input: {
  customerId: number;
  employeeId: number;
  serviceId: number;
  durationMin?: number;
  jalaliDate: string;
  time: string;
  notes?: string;
  extras?: ExtraBookingLine[];
  clientOpId?: string;
}) {
  const extras = (input.extras ?? []).filter((line) => line.serviceId && line.employeeId);
  if (extras.length === 0) {
    return {
      customerId: input.customerId,
      employeeId: input.employeeId,
      services: [
        {
          serviceId: input.serviceId,
          ...(input.durationMin != null ? { durationMin: input.durationMin } : {}),
        },
      ],
      jalaliDate: input.jalaliDate,
      time: input.time,
      ...(input.notes ? { notes: input.notes } : {}),
    };
  }

  return {
    customerId: input.customerId,
    jalaliDate: input.jalaliDate,
    time: input.time,
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.clientOpId ? { clientOpId: input.clientOpId } : {}),
    selections: [
      { serviceId: input.serviceId, employeeId: input.employeeId },
      ...extras.map((line) => ({
        serviceId: Number(line.serviceId),
        employeeId: Number(line.employeeId),
        ...(line.time ? { time: line.time } : {}),
      })),
    ],
  };
}
