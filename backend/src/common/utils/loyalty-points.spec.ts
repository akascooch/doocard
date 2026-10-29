import { pointsFromPaidAppointmentRial } from './loyalty-points';

describe('pointsFromPaidAppointmentRial', () => {
  it('awards 5 points per 1_000_000 toman of paid appointment spend', () => {
    // 1,000,000 toman = 10,000,000 rial
    expect(pointsFromPaidAppointmentRial(10_000_000)).toBe(5);
    expect(pointsFromPaidAppointmentRial(19_999_999)).toBe(5);
    expect(pointsFromPaidAppointmentRial(20_000_000)).toBe(10);
  });

  it('returns 0 for null/zero/negative', () => {
    expect(pointsFromPaidAppointmentRial(null)).toBe(0);
    expect(pointsFromPaidAppointmentRial(0)).toBe(0);
    expect(pointsFromPaidAppointmentRial(-100)).toBe(0);
  });
});
