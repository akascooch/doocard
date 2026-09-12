import { CalendarService } from './calendar.service';
import {
  tehranIsoFromUtcMidnightAndTime,
  utcMidnightToYmd,
} from './tehran-civil-datetime.util';

describe('tehran civil datetime', () => {
  const calendar = new CalendarService({} as any);

  it('maps Jalali 1400-01-01 to Gregorian 2021-03-21 without a day shift', () => {
    const utcMidnight = calendar.toGregorian('1400-01-01');
    expect(utcMidnightToYmd(utcMidnight)).toBe('2021-03-21');
    expect(utcMidnight.toISOString().startsWith('2021-03-21')).toBe(true);
  });

  it('keeps 14:30 Asia/Tehran on the same civil day after conversion', () => {
    const utcMidnight = calendar.toGregorian('1400-01-01');
    const iso = tehranIsoFromUtcMidnightAndTime(utcMidnight, '14:30');
    expect(iso).toBe('2021-03-21T14:30:00+03:30');
    expect(new Date(iso).toISOString()).toBe('2021-03-21T11:00:00.000Z');
    expect(
      new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' }),
    ).toBe('2021-03-21');
  });

  it('rejects invalid Jalali dates', () => {
    expect(() => calendar.toGregorian('1400-13-01')).toThrow();
    expect(() => calendar.toGregorian('not-a-date')).toThrow();
    expect(() => calendar.toGregorian('1400/01/01')).toThrow();
    expect(() => calendar.toGregorian('1400-12-30')).toThrow();
  });

  it('preserves the Jalali year boundary around Nowruz 1400', () => {
    expect(utcMidnightToYmd(calendar.toGregorian('1399-12-30'))).toBe('2021-03-20');
    expect(utcMidnightToYmd(calendar.toGregorian('1400-01-01'))).toBe('2021-03-21');
  });

  it('preserves the Jalali month boundary Shahrivar → Mehr 1400', () => {
    expect(utcMidnightToYmd(calendar.toGregorian('1400-06-31'))).toBe('2021-09-22');
    expect(utcMidnightToYmd(calendar.toGregorian('1400-07-01'))).toBe('2021-09-23');
  });

  it('maps Tehran 00:00 to the same civil day at +03:30', () => {
    const utcMidnight = calendar.toGregorian('1400-01-01');
    const iso = tehranIsoFromUtcMidnightAndTime(utcMidnight, '00:00');
    expect(iso).toBe('2021-03-21T00:00:00+03:30');
    expect(new Date(iso).toISOString()).toBe('2021-03-20T20:30:00.000Z');
    expect(
      new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' }),
    ).toBe('2021-03-21');
  });

  it('maps Tehran 23:59 to the same civil day at +03:30', () => {
    const utcMidnight = calendar.toGregorian('1400-01-01');
    const iso = tehranIsoFromUtcMidnightAndTime(utcMidnight, '23:59');
    expect(iso).toBe('2021-03-21T23:59:00+03:30');
    expect(new Date(iso).toISOString()).toBe('2021-03-21T20:29:00.000Z');
    expect(
      new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' }),
    ).toBe('2021-03-21');
  });

  it('rejects invalid wall-clock times', () => {
    const utcMidnight = calendar.toGregorian('1400-01-01');
    expect(() => tehranIsoFromUtcMidnightAndTime(utcMidnight, '24:00')).toThrow();
    expect(() => tehranIsoFromUtcMidnightAndTime(utcMidnight, '14:60')).toThrow();
    expect(() => tehranIsoFromUtcMidnightAndTime(utcMidnight, '')).toThrow();
  });
});
