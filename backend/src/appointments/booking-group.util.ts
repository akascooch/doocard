export type BookingInterval = {
  employeeId: number;
  start: Date;
  end: Date;
};

export function bookingIntervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Same barber + overlapping window is a conflict, including inside one submission.
 * Different barbers at the same start are allowed (simultaneous services).
 */
export function findSameBarberOverlap(
  lines: BookingInterval[],
): { a: number; b: number } | null {
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i].employeeId !== lines[j].employeeId) continue;
      if (
        bookingIntervalsOverlap(
          lines[i].start,
          lines[i].end,
          lines[j].start,
          lines[j].end,
        )
      ) {
        return { a: i, b: j };
      }
    }
  }
  return null;
}
