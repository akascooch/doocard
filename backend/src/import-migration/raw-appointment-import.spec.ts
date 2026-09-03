import * as fs from 'fs';
import {
  filterDifferentialAppointmentDays,
  GENERIC_IMPORT_CUSTOMER_PHONE,
  parseRawAppointmentWorkbookFromPath,
  persianToEnglishDigits,
} from '../import/lib/appointment-workbook.parser';
import type { ParsedAppointmentRow } from '../import/lib/appointment-workbook.parser';

const SAMPLE_PATH =
  process.env.APPT_XLSX_PATH || 'C:/Users/a.hosseini/Desktop/apk/files/خرداد.xlsx';
const sampleExists = fs.existsSync(SAMPLE_PATH);

describe('raw appointment workbook parser', () => {
  it('normalizes Persian digits', () => {
    expect(persianToEnglishDigits('۱۴۰۴/۰۳/۰۱')).toBe('1404/03/01');
  });

  it('skips dates when excel count matches DB count', () => {
    const row = (dateKey: string, rowNumber: number): ParsedAppointmentRow => ({
      sourceFile: 't.xlsx',
      rowNumber,
      jalaliDateRaw: dateKey,
      jalaliDateKey: dateKey,
      customerPhone: GENERIC_IMPORT_CUSTOMER_PHONE,
      customerName: 'A',
      employeeShareRial: 0n,
      sharePercent: null,
      employeeName: 'B',
      employeePhone: '09121111111',
      totalPriceRial: 1000n,
      serviceNameRaw: 'S',
      serviceNameCanonical: 'S',
    });
    const dbCounts = new Map([
      ['1404-03-01', 1],
      ['1404-03-02', 1],
    ]);
    const filtered = filterDifferentialAppointmentDays(
      [row('1404-03-01', 1), row('1404-03-02', 2), row('1404-03-02', 3)],
      dbCounts,
    );
    expect(filtered.eligible).toHaveLength(2);
    expect(filtered.skippedMatchedDays).toHaveLength(1);
    expect(filtered.skippedMatchedDays[0].jalaliDateKey).toBe('1404-03-01');
  });

  (sampleExists ? it : it.skip)('parses sample raw export workbook', () => {
    const result = parseRawAppointmentWorkbookFromPath(SAMPLE_PATH);
    expect(result.rows.length).toBeGreaterThan(100);
    expect(result.rows.some((r) => r.customerPhone === GENERIC_IMPORT_CUSTOMER_PHONE)).toBe(true);
  });
});
