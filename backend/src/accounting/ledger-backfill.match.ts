/**
 * Pure helpers for employee-ledger name matching (backfill).
 * No DB access — unit-testable.
 */

export type MatchStrategy =
  | 'EXACT_FULL_NAME'
  | 'UNIQUE_FIRST_TOKEN'
  | 'AMBIGUOUS'
  | 'UNMATCHED';

export interface EmployeeNameRow {
  employeeId: number;
  name: string;
  isActive: boolean;
}

export interface MatchResult {
  strategy: MatchStrategy;
  employeeId: number | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
  candidateEmployeeIds: number[];
  normalizedQuery: string;
  notes: string;
}

export function normalizePersonName(input: string): string {
  return (input || '')
    .replace(/\u200c/g, ' ')
    .replace(/[ي]/g, 'ی')
    .replace(/[ك]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Extract counterparty from legacy «طرف حساب: Name» descriptions. */
export function extractCounterpartyName(description: string | null | undefined): string {
  const raw = (description || '').trim();
  if (!raw) return '';
  const marker = 'طرف حساب:';
  const idx = raw.indexOf(marker);
  if (idx >= 0) {
    return normalizePersonName(raw.slice(idx + marker.length));
  }
  return normalizePersonName(raw);
}

export function firstToken(name: string): string {
  const n = normalizePersonName(name);
  return n.split(' ')[0] || '';
}

export function matchEmployeeByDescription(
  description: string | null | undefined,
  employees: EmployeeNameRow[],
): MatchResult {
  const query = extractCounterpartyName(description);
  if (!query) {
    return {
      strategy: 'UNMATCHED',
      employeeId: null,
      confidence: 'none',
      candidateEmployeeIds: [],
      normalizedQuery: '',
      notes: 'Empty description',
    };
  }

  const exact = employees.filter(
    (e) => normalizePersonName(e.name) === query,
  );
  if (exact.length === 1) {
    return {
      strategy: 'EXACT_FULL_NAME',
      employeeId: exact[0].employeeId,
      confidence: 'high',
      candidateEmployeeIds: [exact[0].employeeId],
      normalizedQuery: query,
      notes: 'Exact full-name match',
    };
  }
  if (exact.length > 1) {
    return {
      strategy: 'AMBIGUOUS',
      employeeId: null,
      confidence: 'low',
      candidateEmployeeIds: exact.map((e) => e.employeeId),
      normalizedQuery: query,
      notes: 'Multiple exact full-name matches',
    };
  }

  const token = firstToken(query);
  if (!token) {
    return {
      strategy: 'UNMATCHED',
      employeeId: null,
      confidence: 'none',
      candidateEmployeeIds: [],
      normalizedQuery: query,
      notes: 'No first token',
    };
  }

  const byFirst = employees.filter((e) => firstToken(e.name) === token);
  if (byFirst.length === 1) {
    return {
      strategy: 'UNIQUE_FIRST_TOKEN',
      employeeId: byFirst[0].employeeId,
      confidence: 'medium',
      candidateEmployeeIds: [byFirst[0].employeeId],
      normalizedQuery: query,
      notes: 'Unique first-token match (candidate only; not auto-applied)',
    };
  }
  if (byFirst.length > 1) {
    return {
      strategy: 'AMBIGUOUS',
      employeeId: null,
      confidence: 'low',
      candidateEmployeeIds: byFirst.map((e) => e.employeeId),
      normalizedQuery: query,
      notes: `Ambiguous first-token "${token}"`,
    };
  }

  return {
    strategy: 'UNMATCHED',
    employeeId: null,
    confidence: 'none',
    candidateEmployeeIds: [],
    normalizedQuery: query,
    notes: 'No employee match',
  };
}

export function splitEqualRial(
  pool: bigint,
  ids: number[],
): { employeeId: number; amountRial: bigint }[] {
  if (ids.length === 0) return [];
  const sorted = [...ids].sort((a, b) => a - b);
  const n = BigInt(sorted.length);
  const base = pool / n;
  const remainder = Number(pool % n);
  return sorted.map((employeeId, index) => ({
    employeeId,
    amountRial: base + (index < remainder ? 1n : 0n),
  }));
}

/** Personal tip: 100% to one SERVICE employee. */
export function computePersonalTipAllocations(
  tipRial: bigint,
  serviceEmployeeId: number,
): { employeeId: number; amountRial: bigint; role: 'SERVICE_TIP' }[] {
  return [
    { employeeId: serviceEmployeeId, amountRial: tipRial, role: 'SERVICE_TIP' },
  ];
}

/**
 * Team tip: 100% of tipRial split equally among unique SERVICE member IDs.
 * Deterministic remainder: first r employees (ascending id) get +1 IRR.
 * Non-SERVICE recipients must be filtered out by the caller before invoke.
 *
 * @param _barberEmployeeId Deprecated — ignored. Kept for call-site compatibility.
 */
export function computeTeamTipAllocations(
  tipRial: bigint,
  _barberEmployeeId: number | null | undefined,
  serviceMemberIds: number[],
): {
  employeeId: number;
  amountRial: bigint;
  role: 'SERVICE_TIP';
}[] {
  const uniqueIds = [
    ...new Set(
      (serviceMemberIds || [])
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
  if (uniqueIds.length === 0) {
    throw new Error('TEAM tip requires at least one service member');
  }
  if (tipRial < 0n) {
    throw new Error('TEAM tip amount must be non-negative');
  }
  return splitEqualRial(tipRial, uniqueIds).map((r) => ({
    ...r,
    role: 'SERVICE_TIP' as const,
  }));
}
