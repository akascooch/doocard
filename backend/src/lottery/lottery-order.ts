export type LotteryOrderMember = {
  id: number;
  employeeId: number;
  joinedAt: Date;
};

export type LotteryPrevSlot = {
  slotIndex: number;
  memberId: number;
};

/**
 * Deterministic next-cycle queue. No Math.random().
 * Last two previous slots (relative order) become 1–2 if still active;
 * vacancies fill by walking the previous cycle from the end.
 */
export function nextCycleOrder(
  previousSlots: LotteryPrevSlot[],
  activeMembers: LotteryOrderMember[],
): number[] {
  const byId = new Map(activeMembers.map((m) => [m.id, m]));
  const prevOrder = [...previousSlots]
    .sort((a, b) => a.slotIndex - b.slotIndex)
    .map((s) => s.memberId);

  const priority: number[] = [];
  const lastTwo = prevOrder.slice(-2);
  for (const id of lastTwo) {
    if (byId.has(id) && !priority.includes(id)) priority.push(id);
  }
  if (priority.length < 2) {
    for (const id of [...prevOrder].reverse()) {
      if (byId.has(id) && !priority.includes(id)) {
        priority.push(id);
        if (priority.length === 2) break;
      }
    }
  }

  const rest = prevOrder.filter((id) => byId.has(id) && !priority.includes(id));
  const prevSet = new Set(prevOrder);
  const newcomers = activeMembers
    .filter((m) => !prevSet.has(m.id))
    .sort((a, b) => {
      const t = a.joinedAt.getTime() - b.joinedAt.getTime();
      if (t !== 0) return t;
      return a.employeeId - b.employeeId;
    })
    .map((m) => m.id);

  const queue = [...priority, ...rest, ...newcomers];
  const unique: number[] = [];
  for (const id of queue) {
    if (byId.has(id) && !unique.includes(id)) unique.push(id);
  }
  return unique;
}
