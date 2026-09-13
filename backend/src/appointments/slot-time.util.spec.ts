import { normalizeBookingClockTime, SLOT_INTERVAL_MIN } from './slot-time.util';

describe('normalizeBookingClockTime', () => {
  it('accepts canonical 30-minute clocks and drops seconds', () => {
    expect(normalizeBookingClockTime('14:00')).toBe('14:00');
    expect(normalizeBookingClockTime('14:30')).toBe('14:30');
    expect(normalizeBookingClockTime('14:30:05')).toBe('14:30');
    expect(normalizeBookingClockTime('۱۴:۳۰')).toBe('14:30');
  });

  it('extracts Tehran HH:mm from an ISO instant instead of splitting the timestamp', () => {
    // 10:30 UTC = 14:00 in Asia/Tehran (UTC+03:30)
    expect(normalizeBookingClockTime('2021-03-21T10:30:00.000Z')).toBe('14:00');
  });

  it('rejects off-grid minutes rather than rounding them', () => {
    expect(normalizeBookingClockTime('14:15')).toBeNull();
    expect(normalizeBookingClockTime('14:10')).toBeNull();
    expect(normalizeBookingClockTime('not-a-time')).toBeNull();
    expect(normalizeBookingClockTime('24:00')).toBeNull();
  });

  it('keeps the 30-minute interval constant', () => {
    expect(SLOT_INTERVAL_MIN).toBe(30);
  });
});
