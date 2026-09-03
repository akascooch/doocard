import {
  formatJalaliFromUtcInstant,
  gregorianYmdToTehranHalfOpenDay,
  jalaliToTehranHalfOpenDay,
  jalaliToTehranClosedRange,
} from './tehran-business-day';

describe('tehran-business-day', () => {
  it('jalali half-open day is 24h and exclusive end', () => {
    const r = jalaliToTehranHalfOpenDay('1405/04/20');
    expect(r).not.toBeNull();
    expect(r!.endExclusive.getTime() - r!.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('closed range end is last ms of Tehran day', () => {
    const r = jalaliToTehranClosedRange('1405/04/20');
    expect(r).not.toBeNull();
    const half = jalaliToTehranHalfOpenDay('1405/04/20')!;
    expect(r!.endInclusive.getTime()).toBe(half.endExclusive.getTime() - 1);
  });

  it('gregorian YMD matches Tehran civil day for 2026-07-11 (1405/04/20)', () => {
    const g = gregorianYmdToTehranHalfOpenDay('2026-07-11');
    const j = jalaliToTehranHalfOpenDay('1405/04/20');
    expect(g).not.toBeNull();
    expect(j).not.toBeNull();
    expect(g!.start.toISOString()).toBe(j!.start.toISOString());
  });

  it('formats UTC instant around Tehran midnight boundary', () => {
    const day = jalaliToTehranHalfOpenDay('1405/04/20')!;
    // just before end of day
    const almostEnd = new Date(day.endExclusive.getTime() - 1);
    expect(formatJalaliFromUtcInstant(almostEnd)).toBe('1405/04/20');
    // exactly next day start
    expect(formatJalaliFromUtcInstant(day.endExclusive)).toBe('1405/04/21');
  });
});
