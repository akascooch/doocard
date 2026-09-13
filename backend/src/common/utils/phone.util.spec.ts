import { normalizeIranMobile } from './phone.util';

describe('normalizeIranMobile', () => {
  it('accepts 09, +98, 98, and 0098 forms', () => {
    expect(normalizeIranMobile('09120000000')).toBe('09120000000');
    expect(normalizeIranMobile('+989120000000')).toBe('09120000000');
    expect(normalizeIranMobile('989120000000')).toBe('09120000000');
    expect(normalizeIranMobile('00989120000000')).toBe('09120000000');
  });

  it('rejects invalid numbers', () => {
    expect(normalizeIranMobile('9120000000')).toBeNull();
    expect(normalizeIranMobile('not-a-phone')).toBeNull();
    expect(normalizeIranMobile('08120000000')).toBeNull();
    expect(normalizeIranMobile('009891200000')).toBeNull();
    expect(normalizeIranMobile('')).toBeNull();
  });
});
