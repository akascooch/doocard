import {
  getJalaliYearUtcRange,
  netRialToString,
  parseServiceSnapshots,
  resolveAuthUserId,
} from './employee-dashboard.util';

describe('employee-dashboard.util', () => {
  it('resolves userId from id or sub', () => {
    expect(resolveAuthUserId({ id: 12 })).toBe(12);
    expect(resolveAuthUserId({ sub: 9 })).toBe(9);
    expect(resolveAuthUserId({ id: 12, sub: 99 })).toBe(12);
    expect(resolveAuthUserId({})).toBeNull();
    expect(resolveAuthUserId(null)).toBeNull();
  });

  it('serializes net rial without dropping bigint', () => {
    expect(netRialToString(4_200_000n)).toBe('4200000');
    expect(netRialToString(null)).toBe('0');
  });

  it('parses service snapshots', () => {
    expect(
      parseServiceSnapshots([{ serviceName: 'اصلاح', priceAtBooking: 1_000_000 }]),
    ).toEqual([{ serviceName: 'اصلاح', priceAtBooking: 1_000_000 }]);
    expect(parseServiceSnapshots(null)).toEqual([]);
  });

  it('returns a Tehran-bounded Jalali year range', () => {
    const { start, end } = getJalaliYearUtcRange(1404);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});
