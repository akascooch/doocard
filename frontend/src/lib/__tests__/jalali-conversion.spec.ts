jest.mock('jalaliday', () => ({ __esModule: true, default: () => undefined }));
jest.mock('dayjs/plugin/utc', () => ({ __esModule: true, default: {} }));
jest.mock('dayjs/plugin/timezone', () => ({ __esModule: true, default: {} }));
jest.mock('dayjs/plugin/customParseFormat', () => ({ __esModule: true, default: {} }));
jest.mock('dayjs', () => {
  const api = Object.assign(() => ({}), { extend: () => undefined });
  return { __esModule: true, default: api };
});

import {
  getCurrentJalaliDate,
  getTehranTodayGregorian,
  jalaliToGregorian,
  parseStrictJalaliYmd,
  slotsApiDateFromPicker,
} from '../date';

/** Today Jalali 1405/07/16 concatenated with the typed booking date 1405/10/03. */
const FAILING_BOOKING_INPUT = '1405/07/161405/10/03';

describe('jalali conversion', () => {
  it('round-trips Tehran today through Jalali and Gregorian', () => {
    const jalali = getCurrentJalaliDate();
    expect(jalali).toMatch(/^\d{4}\/\d{2}\/\d{2}$/);
    expect(parseStrictJalaliYmd(jalali)).not.toBeNull();
    expect(jalaliToGregorian(jalali)).toBe(getTehranTodayGregorian());
    expect(slotsApiDateFromPicker(jalali)).toBe(getTehranTodayGregorian());
  });

  it('converts leap-year Esfand 30 and rejects the following non-leap day', () => {
    expect(jalaliToGregorian('1403/12/30')).toBe('2025-03-20');
    expect(parseStrictJalaliYmd('1403/12/30')).toEqual({ jy: 1403, jm: 12, jd: 30 });
    expect(parseStrictJalaliYmd('1404/12/30')).toBeNull();
    expect(jalaliToGregorian('1399/12/30')).toBe('2021-03-20');
  });

  it('keeps month boundaries on the 31-day and 30-day sides', () => {
    expect(jalaliToGregorian('1404/06/31')).toBe('2025-09-22');
    expect(jalaliToGregorian('1404/07/01')).toBe('2025-09-23');
    expect(parseStrictJalaliYmd('1404/07/31')).toBeNull();
    expect(slotsApiDateFromPicker('1404/06/31')).toBe('2025-09-22');
    expect(slotsApiDateFromPicker('1405/10/03')).toBe('2026-12-24');
  });

  it('does not roll the concatenated booking input into Jalali 1847/05/30', () => {
    expect(parseStrictJalaliYmd(FAILING_BOOKING_INPUT)).toBeNull();
    expect(slotsApiDateFromPicker(FAILING_BOOKING_INPUT)).toBeNull();
    expect(slotsApiDateFromPicker(FAILING_BOOKING_INPUT)).not.toBe('1847-05-30');
    expect(slotsApiDateFromPicker('1847/05/30')).toBe('2468-08-20');
    expect(slotsApiDateFromPicker('1847/05/30')).not.toBe('1847-05-30');
    expect(slotsApiDateFromPicker('2026-10-08')).toBe('2026-10-08');
  });
});
