jest.mock('jalaliday', () => ({ __esModule: true, default: () => undefined }));
jest.mock('dayjs/plugin/utc', () => ({ __esModule: true, default: {} }));
jest.mock('dayjs/plugin/timezone', () => ({ __esModule: true, default: {} }));
jest.mock('dayjs/plugin/customParseFormat', () => ({ __esModule: true, default: {} }));
jest.mock('dayjs', () => {
  const api = Object.assign(
    () => ({
      calendar: () => ({
        locale: () => ({
          format: () => '',
        }),
      }),
    }),
    { extend: () => undefined },
  );
  return { __esModule: true, default: api };
});

import {
  formatTehranJalaliValue,
  formatToJalali,
  getTehranCurrentJalaliMonthRange,
  getTehranGregorianDateParts,
  getTehranTodayJalali,
  isValidJalaliValue,
  parseFromJalali,
  safeToGregorian,
  safeToJalaali,
} from '../date';

function assertNeverThrows(label: string, fn: () => unknown) {
  let threw: unknown = null;
  let result: unknown;
  try {
    result = fn();
  } catch (error) {
    threw = error;
  }
  expect({ label, threw }).toEqual({ label, threw: null });
  return result;
}

describe('Safari / malformed date hardening', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('safeToJalaali never throws on NaN, Infinity, negatives, or out-of-range numbers', () => {
    const inputs: Array<[number, number, number]> = [
      [Number.NaN, Number.NaN, Number.NaN],
      [Number.POSITIVE_INFINITY, 1, 1],
      [Number.NEGATIVE_INFINITY, 1, 1],
      [-100721, 1, 1],
      [0, 0, 0],
      [2026, 13, 1],
      [2026, 2, 30],
      [1, 1, 1],
    ];
    for (const [gy, gm, gd] of inputs) {
      const result = assertNeverThrows(`safeToJalaali(${gy},${gm},${gd})`, () =>
        safeToJalaali(gy, gm, gd),
      );
      expect(result).toBeNull();
    }
  });

  it('safeToGregorian never throws on invalid Jalali fields', () => {
    const inputs: Array<[number, number, number]> = [
      [Number.NaN, 1, 1],
      [Number.POSITIVE_INFINITY, 6, 1],
      [-1, 1, 1],
      [1403, 13, 1],
      [1403, 12, 32],
      [0, 0, 0],
    ];
    for (const [jy, jm, jd] of inputs) {
      const result = assertNeverThrows(`safeToGregorian(${jy},${jm},${jd})`, () =>
        safeToGregorian(jy, jm, jd),
      );
      expect(result).toBeNull();
    }
  });

  it('string parsers never throw on malformed or Persian-digit input', () => {
    const strings = [
      '',
      '   ',
      'NaN-NaN-NaN',
      '2026/09/17',
      '۱۴۰۳/۰۶/۲۷',
      '1403/06/27',
      'not-a-date',
      '1403-13-01',
    ];
    for (const value of strings) {
      assertNeverThrows(`formatToJalali(${value})`, () => formatToJalali(value));
      assertNeverThrows(`parseFromJalali(${value})`, () => parseFromJalali(value));
      assertNeverThrows(`isValidJalaliValue(${value})`, () => isValidJalaliValue(value));
      assertNeverThrows(`formatTehranJalaliValue(${value})`, () => formatTehranJalaliValue(value));
    }
    assertNeverThrows('formatTehranJalaliValue(null)', () => formatTehranJalaliValue(null));
    assertNeverThrows('formatTehranJalaliValue(undefined)', () =>
      formatTehranJalaliValue(undefined),
    );
    expect(formatToJalali('')).toBe('');
    expect(parseFromJalali('')).toBeNull();
    expect(parseFromJalali('NaN-NaN-NaN')).toBeNull();
    expect(isValidJalaliValue('۱۴۰۳/۰۶/۲۷')).toBe(true);
    expect(parseFromJalali('۱۴۰۳/۰۶/۲۷')).toBeInstanceOf(Date);
  });

  it('getTehranTodayJalali and month range never throw and return predictable shapes', () => {
    const today = assertNeverThrows('getTehranTodayJalali', () => getTehranTodayJalali());
    const range = assertNeverThrows('getTehranCurrentJalaliMonthRange', () =>
      getTehranCurrentJalaliMonthRange(),
    ) as { from: string; to: string };
    expect(typeof today).toBe('string');
    expect(today === '' || /^\d{4}\/\d{2}\/\d{2}$/.test(String(today))).toBe(true);
    expect(range).toEqual(
      expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
      }),
    );
    if (range.from && range.to) {
      expect(range.from <= range.to).toBe(true);
    }
  });

  it('formatToParts slash / Persian-digit Safari simulation falls back instead of throwing', () => {
    const spy = jest.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(() => [
      { type: 'year', value: '۲۰۲۶' },
      { type: 'literal', value: '/' },
      { type: 'month', value: '۰۹' },
      { type: 'literal', value: '/' },
      { type: 'day', value: '۱۷' },
    ]);
    const parts = assertNeverThrows('getTehranGregorianDateParts safari', () =>
      getTehranGregorianDateParts(new Date('2026-09-17T12:00:00.000Z')),
    );
    expect(parts === null || (typeof parts === 'object' && Number.isInteger((parts as { gy: number }).gy))).toBe(
      true,
    );
    const today = assertNeverThrows('getTehranTodayJalali safari', () => getTehranTodayJalali());
    expect(typeof today).toBe('string');
    const range = assertNeverThrows('month range safari', () => getTehranCurrentJalaliMonthRange());
    expect(range).toBeTruthy();
    spy.mockRestore();
  });

  it('formatToParts throw path uses Tehran offset fallback and still does not throw', () => {
    jest.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts').mockImplementation(() => {
      throw new Error('simulated Intl failure');
    });
    const parts = assertNeverThrows('getTehranGregorianDateParts throw', () =>
      getTehranGregorianDateParts(new Date('2026-09-17T08:30:00.000Z')),
    ) as { gy: number; gm: number; gd: number } | null;
    expect(parts).toEqual({ gy: 2026, gm: 9, gd: 17 });
    expect(() => getTehranTodayJalali()).not.toThrow();
    expect(() => getTehranCurrentJalaliMonthRange()).not.toThrow();
  });

  it('invalid Date objects return null/empty instead of bubbling to Error Boundary', () => {
    const invalid = new Date('not-a-real-date');
    expect(Number.isNaN(invalid.getTime())).toBe(true);
    expect(assertNeverThrows('parts invalid Date', () => getTehranGregorianDateParts(invalid))).toBeNull();
    expect(assertNeverThrows('format invalid Date', () => formatToJalali(invalid))).toBe('');
  });
});
