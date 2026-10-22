import { nextCycleOrder, type LotteryOrderMember } from './lottery-order';

const joined = (id: number, employeeId: number, day: string): LotteryOrderMember => ({
  id,
  employeeId,
  joinedAt: new Date(day),
});

const slots = (ids: number[]) => ids.map((memberId, i) => ({ slotIndex: i + 1, memberId }));

describe('nextCycleOrder fairness vectors', () => {
  const A = joined(1, 10, '2026-01-01');
  const B = joined(2, 11, '2026-01-02');
  const C = joined(3, 12, '2026-01-03');
  const D = joined(4, 13, '2026-01-04');
  const E = joined(5, 14, '2026-01-05');
  const F = joined(6, 15, '2026-01-06');
  const G = joined(7, 16, '2026-06-01');
  const prev = slots([1, 2, 3, 4, 5, 6]);

  it('1 all stay: last two E,F become 1–2 then remainder', () => {
    expect(nextCycleOrder(prev, [A, B, C, D, E, F])).toEqual([5, 6, 1, 2, 3, 4]);
  });

  it('2 one of last-two leaves: F skipped, fill D from the end', () => {
    expect(nextCycleOrder(prev, [A, B, C, D, E])).toEqual([5, 4, 1, 2, 3]);
  });

  it('3 both last-two leave: D then C from the end', () => {
    expect(nextCycleOrder(prev, [A, B, C, D])).toEqual([4, 3, 1, 2]);
  });

  it('4 new joiner G is appended after previous remainder', () => {
    expect(nextCycleOrder(prev, [A, B, C, D, E, F, G])).toEqual([5, 6, 1, 2, 3, 4, 7]);
  });

  it('5 cycle 1 no history: join date then employeeId', () => {
    const lateA = joined(1, 30, '2026-02-01');
    const earlyC = joined(3, 10, '2026-01-01');
    const midB = joined(2, 20, '2026-01-15');
    expect(nextCycleOrder([], [lateA, earlyC, midB])).toEqual([3, 2, 1]);
  });

  it('6 arrears do not change order (same as vector 1)', () => {
    expect(nextCycleOrder(prev, [A, B, C, D, E, F])).toEqual([5, 6, 1, 2, 3, 4]);
  });
});
