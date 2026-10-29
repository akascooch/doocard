import { BadRequestException } from '@nestjs/common';
import {
  buildChequeLeafDueDateWhere,
  extractGregorianYmdFromQueryDate,
} from './cheque-leaf-due-date-filter';
import { gregorianYmdToTehranHalfOpenDay } from '../common/utils/tehran-business-day';

describe('cheque-leaf-due-date-filter', () => {
  describe('extractGregorianYmdFromQueryDate', () => {
    it('parses YYYY-MM-DD and ISO datetime prefixes', () => {
      expect(extractGregorianYmdFromQueryDate('2026-10-22')).toBe('2026-10-22');
      expect(
        extractGregorianYmdFromQueryDate('2026-10-22T12:00:00.000Z'),
      ).toBe('2026-10-22');
      expect(extractGregorianYmdFromQueryDate('')).toBeNull();
      expect(extractGregorianYmdFromQueryDate('not-a-date')).toBeNull();
      expect(extractGregorianYmdFromQueryDate('2026-13-40')).toBeNull();
    });
  });

  describe('buildChequeLeafDueDateWhere', () => {
    it('returns undefined when both bounds absent', () => {
      expect(buildChequeLeafDueDateWhere()).toBeUndefined();
      expect(buildChequeLeafDueDateWhere('', '')).toBeUndefined();
      expect(buildChequeLeafDueDateWhere(null, undefined)).toBeUndefined();
    });

    it('applies gte/lte Tehran day bounds and excludes null dueDate', () => {
      const from = gregorianYmdToTehranHalfOpenDay('2026-10-01')!;
      const to = gregorianYmdToTehranHalfOpenDay('2026-10-31')!;
      const where = buildChequeLeafDueDateWhere('2026-10-01', '2026-10-31');
      expect(where).toEqual({
        dueDate: {
          not: null,
          gte: from.start,
          lte: new Date(to.endExclusive.getTime() - 1),
        },
      });
    });

    it('supports one-sided bounds', () => {
      const from = gregorianYmdToTehranHalfOpenDay('2026-10-15')!;
      const onlyFrom = buildChequeLeafDueDateWhere('2026-10-15', undefined);
      expect(onlyFrom?.dueDate).toEqual({
        not: null,
        gte: from.start,
      });

      const to = gregorianYmdToTehranHalfOpenDay('2026-10-20')!;
      const onlyTo = buildChequeLeafDueDateWhere(undefined, '2026-10-20');
      expect(onlyTo?.dueDate).toEqual({
        not: null,
        lte: new Date(to.endExclusive.getTime() - 1),
      });
    });

    it('rejects inverted or invalid ranges', () => {
      expect(() =>
        buildChequeLeafDueDateWhere('2026-10-31', '2026-10-01'),
      ).toThrow(BadRequestException);
      expect(() => buildChequeLeafDueDateWhere('bad', undefined)).toThrow(
        BadRequestException,
      );
      expect(() =>
        buildChequeLeafDueDateWhere(undefined, 'also-bad'),
      ).toThrow(BadRequestException);
    });
  });
});
