import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { persianToEnglishDigits } from './appointment-workbook.parser';

export interface ParsedCustomerRow {
  sourceFile: string;
  rowNumber: number;
  name: string;
  phone: string;
  email: string | null;
  birthdateRaw: string | null;
  notes: string | null;
}

export interface CustomerParseFailure {
  rowNumber: number;
  reason: string;
  phone?: string;
}

export interface CustomerParseResult {
  rows: ParsedCustomerRow[];
  failures: CustomerParseFailure[];
  headerRowIndex: number;
  totalDataRows: number;
}

export type SerializedCustomerRow = ParsedCustomerRow;

export function normalizeCustomerPhone(raw: string): string | null {
  if (!raw) return null;
  let p = persianToEnglishDigits(raw).replace(/[\s\-()]/g, '');
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
  if (!/^09\d{9}$/.test(p)) return null;
  return p;
}

function normalizeHeaderLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function detectCustomerHeaderRow(sheet: XLSX.WorkSheet, maxScan = 15): number | null {
  const ref = sheet['!ref'];
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);

  for (let r = range.s.r; r <= Math.min(range.s.r + maxScan, range.e.r); r++) {
    const labels: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell == null || cell.v == null) continue;
      labels.push(normalizeHeaderLabel(cell.v));
    }
    const hasName = labels.some((l) => l === 'نام' || l === 'name' || l.includes('نام مشتری'));
    const hasPhone = labels.some(
      (l) => l === 'تلفن' || l === 'موبایل' || l === 'phone' || l.includes('شماره'),
    );
    if (hasName && hasPhone) return r;
  }
  return null;
}

function getCellString(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim() !== '') return String(direct).trim();
    for (const [k, v] of Object.entries(row)) {
      if (k.trim() === key && v != null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return '';
}

function mapRow(
  data: Record<string, unknown>,
  rowNumber: number,
  sourceFile: string,
): { row?: ParsedCustomerRow; failure?: CustomerParseFailure } {
  const name = getCellString(data, 'نام', 'name', 'Name');
  const phoneRaw = getCellString(data, 'تلفن', 'موبایل', 'phone', 'Phone');
  const emailRaw = getCellString(data, 'ایمیل', 'email', 'Email');
  const birthdateRaw = getCellString(data, 'تاریخ تولد', 'birthdate', 'Birthdate') || null;
  const notesRaw = getCellString(data, 'یادداشت', 'notes', 'Notes') || null;

  const phone = normalizeCustomerPhone(phoneRaw);
  const missing: string[] = [];
  if (!name || name.length < 2) missing.push('invalid_name');
  if (!phone) missing.push('invalid_phone');
  if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) missing.push('invalid_email');

  if (missing.length) {
    return {
      failure: {
        rowNumber,
        reason: missing.join(','),
        phone: phoneRaw || undefined,
      },
    };
  }

  return {
    row: {
      sourceFile,
      rowNumber,
      name: name.trim(),
      phone: phone!,
      email: emailRaw || null,
      birthdateRaw,
      notes: notesRaw,
    },
  };
}

export function parseCustomerWorkbookFromBuffer(
  buffer: Buffer,
  sourceFile: string,
): CustomerParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  let headerRowIndex = detectCustomerHeaderRow(sheet);
  if (headerRowIndex == null) headerRowIndex = 0;

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRowIndex,
    defval: '',
  });

  const rows: ParsedCustomerRow[] = [];
  const failures: CustomerParseFailure[] = [];

  json.forEach((data, idx) => {
    const rowNumber = headerRowIndex + idx + 2;
    const mapped = mapRow(data, rowNumber, sourceFile);
    if (mapped.failure) failures.push(mapped.failure);
    else if (mapped.row) rows.push(mapped.row);
  });

  return { rows, failures, headerRowIndex, totalDataRows: json.length };
}

export function parseCustomerWorkbookFromPath(filePath: string): CustomerParseResult {
  const buffer = fs.readFileSync(filePath);
  return parseCustomerWorkbookFromBuffer(buffer, path.basename(filePath));
}

export function dedupeCustomerRowsByPhone(rows: ParsedCustomerRow[]): {
  eligible: ParsedCustomerRow[];
  inFileDuplicateRowNumbers: number[];
  inFileDuplicatePhones: Array<{ phone: string; rowNumbers: number[] }>;
} {
  const byPhone = new Map<string, ParsedCustomerRow[]>();
  for (const row of rows) {
    const list = byPhone.get(row.phone) ?? [];
    list.push(row);
    byPhone.set(row.phone, list);
  }

  const eligible: ParsedCustomerRow[] = [];
  const inFileDuplicateRowNumbers: number[] = [];
  const inFileDuplicatePhones: Array<{ phone: string; rowNumbers: number[] }> = [];

  for (const [phone, group] of byPhone.entries()) {
    eligible.push(group[0]);
    if (group.length > 1) {
      const dupRows = group.slice(1).map((r) => r.rowNumber);
      inFileDuplicateRowNumbers.push(...dupRows);
      inFileDuplicatePhones.push({ phone, rowNumbers: group.map((r) => r.rowNumber) });
    }
  }

  return { eligible, inFileDuplicateRowNumbers, inFileDuplicatePhones };
}
