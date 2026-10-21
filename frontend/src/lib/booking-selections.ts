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

/** Backend rejects start times off this grid (slot-time.util SLOT_INTERVAL_MIN). */
export const BOOKING_SLOT_STEP_MIN = 30;

export type BarberLine = { serviceId: number; employeeId: number; durationMin: number };
export type BarberGroup = { employeeId: number; lines: BarberLine[] };

/** Groups lines by barber, keeping the order in which each barber first appears. */
export function groupLinesByBarber(lines: BarberLine[]): BarberGroup[] {
  const groups: BarberGroup[] = [];
  for (const line of lines) {
    const group = groups.find((g) => g.employeeId === line.employeeId);
    if (group) group.lines.push(line);
    else groups.push({ employeeId: line.employeeId, lines: [line] });
  }
  return groups;
}

function roundUpToStep(minutes: number, step = BOOKING_SLOT_STEP_MIN): number {
  return Math.ceil(minutes / step) * step;
}

/** Minutes a barber is occupied when their lines run back-to-back on the slot grid. */
export function groupSpanMin(group: BarberGroup): number {
  let offset = 0;
  group.lines.forEach((line, index) => {
    offset += index === group.lines.length - 1 ? line.durationMin : roundUpToStep(line.durationMin);
  });
  return offset;
}

/** HH:mm plus minutes; null when the result leaves the same day. */
export function addMinutesToClock(clock: string, minutes: number): string | null {
  const match = clock.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const total = Number(match[1]) * 60 + Number(match[2]) + minutes;
  if (total < 0 || total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * Admin multi-service booking with a barber per service.
 * One barber for every line keeps the legacy single-appointment body.
 * Otherwise each service becomes its own appointment via `selections`;
 * a barber's lines run back-to-back from that barber's chosen start (HH:mm).
 */
export function buildMultiBarberCreateBody(input: {
  customerId: number;
  jalaliDate: string;
  notes?: string;
  clientOpId: string;
  lines: BarberLine[];
  groupStartTimes: Record<number, string | null | undefined>;
}) {
  if (input.lines.length === 0) throw new Error('حداقل یک سرویس باید انتخاب شود');
  const groups = groupLinesByBarber(input.lines);
  const startOf = (employeeId: number) => {
    const start = input.groupStartTimes[employeeId];
    if (!start) throw new Error('زمان شروع برای هر آرایشگر الزامی است');
    return start;
  };

  if (groups.length === 1) {
    const [group] = groups;
    return {
      customerId: input.customerId,
      employeeId: group.employeeId,
      services: group.lines.map((line) => ({ serviceId: line.serviceId, durationMin: line.durationMin })),
      jalaliDate: input.jalaliDate,
      time: startOf(group.employeeId),
      ...(input.notes ? { notes: input.notes } : {}),
    };
  }

  const selections: Array<{ serviceId: number; employeeId: number; time: string }> = [];
  for (const group of groups) {
    let clock: string | null = startOf(group.employeeId);
    group.lines.forEach((line, index) => {
      if (!clock) throw new Error('زمان خدمات از پایان روز عبور می‌کند');
      selections.push({ serviceId: line.serviceId, employeeId: line.employeeId, time: clock });
      if (index < group.lines.length - 1) {
        clock = addMinutesToClock(clock, roundUpToStep(line.durationMin));
      }
    });
  }

  return {
    customerId: input.customerId,
    jalaliDate: input.jalaliDate,
    time: selections[0].time,
    ...(input.notes ? { notes: input.notes } : {}),
    clientOpId: input.clientOpId,
    selections,
  };
}
