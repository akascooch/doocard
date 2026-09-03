import { computeTeamTipAllocations } from '../accounting/ledger-backfill.match';

/**
 * Pure helpers mirroring repair categorization (kept unit-testable without DB).
 */
function categorizeLegacyTeam(input: {
  tipAmountRial: bigint;
  snapshotIds: number[];
  serviceIds: number[];
  allocations: { employeeId: number; amountRial: bigint; paid: boolean; role: string }[];
}): string {
  if (input.allocations.some((a) => a.paid)) return 'SKIPPED_SETTLED';
  if (!input.snapshotIds.length) return 'SKIPPED_AMBIGUOUS';
  if (!input.serviceIds.length) return 'FAILED_INVARIANT';
  const expected = computeTeamTipAllocations(
    input.tipAmountRial,
    null,
    input.serviceIds,
  );
  const expectedBy = new Map(expected.map((e) => [e.employeeId, e.amountRial]));
  const currentBy = new Map(input.allocations.map((a) => [a.employeeId, a.amountRial]));
  const nonService = input.allocations.filter((a) => a.role !== 'SERVICE');
  const sum = input.allocations.reduce((s, a) => s + a.amountRial, 0n);
  const already =
    nonService.length === 0 &&
    sum === input.tipAmountRial &&
    expectedBy.size === currentBy.size &&
    [...expectedBy.entries()].every(([id, amt]) => currentBy.get(id) === amt);
  if (already) return 'ALREADY_CORRECT';
  return 'SAFE_TO_REPAIR';
}

describe('repair-team-tip categorization', () => {
  const tip = 34_000_000n; // 3,400,000 Toman
  const serviceIds = [9, 10, 11, 13];

  it('marks legacy 50/50 with non-SERVICE share as SAFE_TO_REPAIR', () => {
    const cat = categorizeLegacyTeam({
      tipAmountRial: tip,
      snapshotIds: serviceIds,
      serviceIds,
      allocations: [
        { employeeId: 1, amountRial: 17_000_000n, paid: false, role: 'ADMIN' },
        { employeeId: 9, amountRial: 4_250_000n, paid: false, role: 'SERVICE' },
        { employeeId: 10, amountRial: 4_250_000n, paid: false, role: 'SERVICE' },
        { employeeId: 11, amountRial: 4_250_000n, paid: false, role: 'SERVICE' },
        { employeeId: 13, amountRial: 4_250_000n, paid: false, role: 'SERVICE' },
      ],
    });
    expect(cat).toBe('SAFE_TO_REPAIR');
    const expected = computeTeamTipAllocations(tip, null, serviceIds);
    expect(expected.every((e) => e.amountRial === 8_500_000n)).toBe(true);
  });

  it('marks settled as SKIPPED_SETTLED', () => {
    expect(
      categorizeLegacyTeam({
        tipAmountRial: tip,
        snapshotIds: serviceIds,
        serviceIds,
        allocations: [
          { employeeId: 9, amountRial: tip, paid: true, role: 'SERVICE' },
        ],
      }),
    ).toBe('SKIPPED_SETTLED');
  });

  it('marks missing snapshot as SKIPPED_AMBIGUOUS', () => {
    expect(
      categorizeLegacyTeam({
        tipAmountRial: tip,
        snapshotIds: [],
        serviceIds: [],
        allocations: [],
      }),
    ).toBe('SKIPPED_AMBIGUOUS');
  });

  it('marks already-correct 100% SERVICE as ALREADY_CORRECT', () => {
    const expected = computeTeamTipAllocations(tip, null, serviceIds);
    expect(
      categorizeLegacyTeam({
        tipAmountRial: tip,
        snapshotIds: serviceIds,
        serviceIds,
        allocations: expected.map((e) => ({
          employeeId: e.employeeId,
          amountRial: e.amountRial,
          paid: false,
          role: 'SERVICE',
        })),
      }),
    ).toBe('ALREADY_CORRECT');
  });

  it('second apply of correct state stays ALREADY_CORRECT (idempotent)', () => {
    const expected = computeTeamTipAllocations(tip, null, serviceIds);
    const once = categorizeLegacyTeam({
      tipAmountRial: tip,
      snapshotIds: serviceIds,
      serviceIds,
      allocations: expected.map((e) => ({
        employeeId: e.employeeId,
        amountRial: e.amountRial,
        paid: false,
        role: 'SERVICE',
      })),
    });
    expect(once).toBe('ALREADY_CORRECT');
  });
});
