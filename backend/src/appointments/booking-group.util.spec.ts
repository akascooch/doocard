import { findSameBarberOverlap } from './booking-group.util';

describe('booking group overlap', () => {
  const start = new Date('2030-01-01T08:00:00.000Z');
  const end = new Date('2030-01-01T08:30:00.000Z');
  const later = new Date('2030-01-01T08:30:00.000Z');
  const laterEnd = new Date('2030-01-01T09:00:00.000Z');

  it('allows two barbers at the same time', () => {
    expect(
      findSameBarberOverlap([
        { employeeId: 1, start, end },
        { employeeId: 2, start, end },
      ]),
    ).toBeNull();
  });

  it('rejects the same barber twice at the same time', () => {
    expect(
      findSameBarberOverlap([
        { employeeId: 1, start, end },
        { employeeId: 1, start, end },
      ]),
    ).toEqual({ a: 0, b: 1 });
  });

  it('allows the same barber when the caller supplies a later non-overlapping start', () => {
    expect(
      findSameBarberOverlap([
        { employeeId: 1, start, end },
        { employeeId: 1, start: later, end: laterEnd },
      ]),
    ).toBeNull();
  });
});
