import {
  computePersonalTipAllocations,
  computeTeamTipAllocations,
  extractCounterpartyName,
  matchEmployeeByDescription,
  normalizePersonName,
  splitEqualRial,
} from './ledger-backfill.match';

describe('ledger-backfill.match', () => {
  const employees = [
    { employeeId: 3, name: 'اشکان اشتیش', isActive: true },
    { employeeId: 4, name: 'آرش بهمن', isActive: true },
    { employeeId: 2, name: 'علی ثابتی', isActive: true },
    { employeeId: 7, name: 'مجید محبوب', isActive: true },
  ];

  it('normalizes arabic ye/kaf and zwnj', () => {
    expect(normalizePersonName('علي\u200cثابتي')).toContain('ی');
  });

  it('extracts طرف حساب counterparty', () => {
    expect(extractCounterpartyName('سامان | طرف حساب: اشکان اشتیش')).toBe(
      'اشکان اشتیش',
    );
  });

  it('exact full-name match is high confidence', () => {
    const r = matchEmployeeByDescription('اشکان اشتیش', employees);
    expect(r.strategy).toBe('EXACT_FULL_NAME');
    expect(r.employeeId).toBe(3);
    expect(r.confidence).toBe('high');
  });

  it('unique first token is candidate only', () => {
    const r = matchEmployeeByDescription('تامی', [
      ...employees,
      { employeeId: 6, name: 'تامی', isActive: true },
    ]);
    expect(r.strategy).toBe('EXACT_FULL_NAME');
    expect(r.employeeId).toBe(6);
  });

  it('ambiguous first token', () => {
    const r = matchEmployeeByDescription('آرش', employees);
    expect(r.strategy).toBe('UNIQUE_FIRST_TOKEN');
    expect(r.employeeId).toBe(4);
    expect(r.confidence).toBe('medium');
  });

  it('ambiguous when two share first token', () => {
    const r = matchEmployeeByDescription('علی', [
      ...employees,
      { employeeId: 99, name: 'علی رضایی', isActive: false },
    ]);
    expect(r.strategy).toBe('AMBIGUOUS');
    expect(r.employeeId).toBeNull();
  });

  it('splits rial with remainder', () => {
    const rows = splitEqualRial(100n, [2, 1, 3]);
    expect(rows.map((r) => r.amountRial)).toEqual([34n, 33n, 33n]);
  });

  it('personal tip is 100%', () => {
    const rows = computePersonalTipAllocations(1_000_000n, 10);
    expect(rows).toEqual([
      { employeeId: 10, amountRial: 1_000_000n, role: 'SERVICE_TIP' },
    ]);
  });

  it('team tip is 100% equal SERVICE split (no barber share)', () => {
    const rows = computeTeamTipAllocations(1_000_000n, 3, [10, 11]);
    expect(rows.every((r) => r.role === 'SERVICE_TIP')).toBe(true);
    expect(rows.find((r) => (r as { role: string }).role === 'BARBER_TEAM_SHARE')).toBeUndefined();
    expect(rows.reduce((s, r) => s + r.amountRial, 0n)).toBe(1_000_000n);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.employeeId).sort((a, b) => a - b)).toEqual([10, 11]);
  });

  it('team tip 34000000 IRR among 4 SERVICE = 8500000 each', () => {
    const rows = computeTeamTipAllocations(34_000_000n, null, [13, 9, 11, 10]);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.amountRial === 8_500_000n)).toBe(true);
    expect(rows.reduce((s, r) => s + r.amountRial, 0n)).toBe(34_000_000n);
  });

  it('team tip dedupes member ids and keeps remainder deterministic', () => {
    const rows = computeTeamTipAllocations(100n, 1, [2, 1, 2, 3]);
    expect(rows.map((r) => r.employeeId)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.amountRial)).toEqual([34n, 33n, 33n]);
    expect(rows.reduce((s, r) => s + r.amountRial, 0n)).toBe(100n);
  });
});
