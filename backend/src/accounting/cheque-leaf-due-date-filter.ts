import { BadRequestException } from '@nestjs/common';
import { gregorianYmdToTehranHalfOpenDay } from '../common/utils/tehran-business-day';

/**
 * Accepts `YYYY-MM-DD` or an ISO datetime whose leading date is that form
 * (e.g. `2026-10-22T12:00:00.000Z`). The calendar day is treated as Asia/Tehran.
 */
export function extractGregorianYmdFromQueryDate(
  raw?: string | null,
): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const ymd = match[1];
  return gregorianYmdToTehranHalfOpenDay(ymd) ? ymd : null;
}

export type ChequeLeafDueDatePrismaFilter = {
  not: null;
  gte?: Date;
  lte?: Date;
};

/**
 * Builds a Prisma `dueDate` filter for cheque leaf listing.
 * When either bound is set, null dueDate rows are excluded (`not: null` + range).
 */
export function buildChequeLeafDueDateWhere(
  dueFrom?: string | null,
  dueTo?: string | null,
): { dueDate: ChequeLeafDueDatePrismaFilter } | undefined {
  const hasFrom = dueFrom != null && String(dueFrom).trim() !== '';
  const hasTo = dueTo != null && String(dueTo).trim() !== '';
  if (!hasFrom && !hasTo) return undefined;

  const fromYmd = hasFrom ? extractGregorianYmdFromQueryDate(dueFrom) : null;
  const toYmd = hasTo ? extractGregorianYmdFromQueryDate(dueTo) : null;

  if (hasFrom && !fromYmd) {
    throw new BadRequestException(
      'dueFrom must be YYYY-MM-DD or an ISO date starting with YYYY-MM-DD',
    );
  }
  if (hasTo && !toYmd) {
    throw new BadRequestException(
      'dueTo must be YYYY-MM-DD or an ISO date starting with YYYY-MM-DD',
    );
  }

  const filter: ChequeLeafDueDatePrismaFilter = { not: null };

  if (fromYmd) {
    const bounds = gregorianYmdToTehranHalfOpenDay(fromYmd)!;
    filter.gte = bounds.start;
  }
  if (toYmd) {
    const bounds = gregorianYmdToTehranHalfOpenDay(toYmd)!;
    // Inclusive end-of-day Tehran (= half-open endExclusive - 1ms).
    filter.lte = new Date(bounds.endExclusive.getTime() - 1);
  }

  if (filter.gte && filter.lte && filter.gte.getTime() > filter.lte.getTime()) {
    throw new BadRequestException('dueFrom must be on or before dueTo');
  }

  return { dueDate: filter };
}
