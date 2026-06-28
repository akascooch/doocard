import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as jalaali from 'jalaali-js';

export const TEHRAN_NOON_UTC_HOUR = 8;
export const TEHRAN_NOON_UTC_MINUTE = 30;
export const NOTES_KEY_PREFIX = 'EXCEL_IMPORT_KEY:';
export const GENERIC_IMPORT_CUSTOMER_PHONE = '09123141478';
export const GENERIC_IMPORT_CUSTOMER_NAME = 'مشتری عمومی';

export const SERVICE_ALIAS_MAP: Record<string, string> = {
  اصلاح: 'اصلاح کامل',
  'مانیکور و پدیکور': 'مانیکور و پدیکور',
};

export type NormalizedRow = Record<string, string | number | null>;

export interface ParsedAppointmentRow {
  sourceFile: string;
  rowNumber: number;
  jalaliDateRaw: string;
  jalaliDateKey: string;
  customerPhone: string;
  customerName: string;
  employeeShareRial: bigint;
  sharePercent: number | null;
  employeeName: string;
  employeePhone: string;
  totalPriceRial: bigint;
  serviceNameRaw: string;
  serviceNameCanonical: string;
  invoiceId?: string;
}

export interface RawAppointmentParseFailure {
  rowNumber: number;
  reason: string;
  jalaliDateRaw?: string;
}

export interface RawAppointmentParseResult {
  rows: ParsedAppointmentRow[];
  failures: RawAppointmentParseFailure[];
  headerRowIndex: number;
  totalDataRows: number;
  format: 'raw-services-export';
}

export interface SkippedMatchedDay {
  jalaliDateKey: string;
  jalaliDateRaw: string;
  excelRowCount: number;
  dbAppointmentCount: number;
  rowNumbers: number[];
}

/** @deprecated use SkippedMatchedDay */
export type SkippedSingletonDay = SkippedMatchedDay & { rowCount?: number };

export interface DifferentialDayFilterResult {
  eligible: ParsedAppointmentRow[];
  skippedMatchedDays: SkippedMatchedDay[];
  skippedRowCount: number;
}

/** @deprecated use DifferentialDayFilterResult */
export type SingletonDayFilterResult = DifferentialDayFilterResult & {
  skippedDays: SkippedMatchedDay[];
};

export interface AppointmentDateGroupPreview {
  jalaliDateKey: string;
  jalaliDateRaw: string;
  rowCount: number;
  excelRowCount: number;
  dbAppointmentCount: number;
  status: 'eligible' | 'count_matched_skipped';
  duplicateCount: number;
  rowNumbers: number[];
}

export function sha1(input: string): string {
  return crypto.createHash('sha1').update(input, 'utf8').digest('hex');
}

export function normalizeExcelHeaders(row: Record<string, unknown>): NormalizedRow {
  const out: NormalizedRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.trim();
    const v =
      value == null ? '' : typeof value === 'number' ? value : String(value).trim();
    out[normalizedKey] = v;
  }
  return out;
}

export function getRowString(row: NormalizedRow, ...keys: string[]): string {
  for (const key of keys) {
    const direct = row[key];
    if (direct != null && String(direct).trim() !== '') {
      return String(direct).trim();
    }
    for (const [k, v] of Object.entries(row)) {
      if (k.trim() === key && v != null && String(v).trim() !== '') {
        return String(v).trim();
      }
    }
  }
  return '';
}

export function parseAmountRial(value: unknown): bigint | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return BigInt(Math.trunc(value));
  }
  const cleaned = String(value)
    .replace(/[,،\s]/g, '')
    .replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const asNumber = Number(cleaned);
  if (!Number.isFinite(asNumber) || asNumber <= 0) return null;
  return BigInt(Math.trunc(asNumber));
}

export function parseSharePercent(raw: string): number | null {
  const cleaned = raw.replace(/%/g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function normalizeIranianPhone(raw: string): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s\-()]/g, '');
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
  if (!/^09\d{9}$/.test(p)) return null;
  return p;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatJalaliKey(jy: number, jm: number, jd: number): string {
  return `${jy}-${pad2(jm)}-${pad2(jd)}`;
}

export function parseJalaliDateYMD(raw: string): { jalaliDateKey: string; at: Date } | null {
  if (!raw?.trim()) return null;
  const normalized = raw.trim().replace(/-/g, '/');
  const parts = normalized.split('/').map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  const g = jalaali.toGregorian(jy, jm, jd);
  const at = new Date(
    Date.UTC(g.gy, g.gm - 1, g.gd, TEHRAN_NOON_UTC_HOUR, TEHRAN_NOON_UTC_MINUTE, 0, 0),
  );
  return { jalaliDateKey: formatJalaliKey(jy, jm, jd), at };
}

export function parseJalaliDateAppointments(raw: string): {
  jalaliDateKey: string;
  scheduledAt: Date;
} | null {
  const parsed = parseJalaliDateYMD(raw);
  if (!parsed) return null;
  return { jalaliDateKey: parsed.jalaliDateKey, scheduledAt: parsed.at };
}

export function resolveServiceName(raw: string): string {
  const trimmed = raw.trim();
  return SERVICE_ALIAS_MAP[trimmed] ?? trimmed;
}

export function computeConservativeAppointmentDedupKey(
  row: ParsedAppointmentRow,
  occurrenceIndex = 0,
): string {
  return sha1(
    [
      row.jalaliDateKey,
      row.employeeName.trim().toLowerCase(),
      row.customerPhone,
      row.customerName.trim().toLowerCase(),
      row.invoiceId ?? '',
      row.serviceNameCanonical,
      row.totalPriceRial.toString(),
      row.employeeShareRial.toString(),
      String(occurrenceIndex),
    ].join('|'),
  );
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function persianToEnglishDigits(str: string): string {
  return str.replace(/[۰-۹٠-٩]/g, (ch) => {
    const p = PERSIAN_DIGITS.indexOf(ch);
    if (p >= 0) return String(p);
    const a = ARABIC_DIGITS.indexOf(ch);
    if (a >= 0) return String(a);
    return ch;
  });
}

export function syntheticPhoneFromStableKey(namespace: string, stableKey: string): string {
  const h = sha1(`${namespace}:${stableKey}`);
  const digits = (h + h).replace(/\D/g, '');
  return `09${digits.slice(0, 9).padStart(9, '0')}`;
}

export function filterDifferentialAppointmentDays(
  rows: ParsedAppointmentRow[],
  dbCountByJalaliDate: Map<string, number>,
): DifferentialDayFilterResult {
  const byDate = new Map<string, ParsedAppointmentRow[]>();
  for (const row of rows) {
    const list = byDate.get(row.jalaliDateKey) ?? [];
    list.push(row);
    byDate.set(row.jalaliDateKey, list);
  }

  const eligible: ParsedAppointmentRow[] = [];
  const skippedMatchedDays: SkippedMatchedDay[] = [];
  let skippedRowCount = 0;

  for (const group of byDate.values()) {
    const jalaliDateKey = group[0].jalaliDateKey;
    const excelRowCount = group.length;
    const dbAppointmentCount = dbCountByJalaliDate.get(jalaliDateKey) ?? 0;

    if (excelRowCount === dbAppointmentCount) {
      skippedMatchedDays.push({
        jalaliDateKey,
        jalaliDateRaw: group[0].jalaliDateRaw,
        excelRowCount,
        dbAppointmentCount,
        rowNumbers: group.map((r) => r.rowNumber),
      });
      skippedRowCount += excelRowCount;
    } else {
      eligible.push(...group);
    }
  }

  skippedMatchedDays.sort((a, b) => a.jalaliDateKey.localeCompare(b.jalaliDateKey));
  return { eligible, skippedMatchedDays, skippedRowCount };
}

/** @deprecated use filterDifferentialAppointmentDays with DB counts */
export function filterSingletonAppointmentDays(
  rows: ParsedAppointmentRow[],
): DifferentialDayFilterResult {
  return filterDifferentialAppointmentDays(rows, new Map());
}

export function detectArzeServicesExportHeaderRow(sheet: XLSX.WorkSheet, maxScan = 15): number | null {
  const ref = sheet['!ref'];
  if (!ref) return null;
  const range = XLSX.utils.decode_range(ref);

  for (let r = range.s.r; r <= Math.min(range.s.r + maxScan, range.e.r); r++) {
    const labels: string[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      if (cell == null || cell.v == null) continue;
      labels.push(String(cell.v).trim());
    }
    const hasTarikh = labels.some((l) => l.replace(/\s/g, '') === 'تاریخ' || l.includes('تاریخ'));
    const hasKarmand = labels.some((l) => l.replace(/\s/g, '') === 'کارمند');
    const hasServiceOrInvoice = labels.some((l) => {
      const t = l.trim();
      return t === 'نام' || t === 'فاکتور' || t.includes('فاکتور');
    });
    if (hasTarikh && hasKarmand && hasServiceOrInvoice) return r;
  }

  return null;
}

export function isRawServicesExportWorkbook(buffer: Buffer): boolean {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return detectArzeServicesExportHeaderRow(sheet) != null;
}

function resolveRawCustomerPhone(row: NormalizedRow): string {
  const mobileRaw = persianToEnglishDigits(getRowString(row, 'موبایل'));
  const phone = normalizeIranianPhone(mobileRaw);
  if (phone) return phone;
  return GENERIC_IMPORT_CUSTOMER_PHONE;
}

function resolveRawCustomerName(row: NormalizedRow): string {
  const name = getRowString(row, 'مشتری').trim();
  return name || GENERIC_IMPORT_CUSTOMER_NAME;
}

function resolveRawEmployeePhone(employeeName: string): string {
  return syntheticPhoneFromStableKey('raw-import-employee', employeeName.trim());
}

function parseRawServicesSheet(
  sheet: XLSX.WorkSheet,
  sourceFile: string,
): RawAppointmentParseResult {
  const headerRowIndex = detectArzeServicesExportHeaderRow(sheet);
  if (headerRowIndex == null) {
    throw new Error(
      'Could not detect raw services export header row (expected تاریخ + کارمند + نام/فاکتور)',
    );
  }

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    range: headerRowIndex,
    defval: '',
  });
  const rows: ParsedAppointmentRow[] = [];
  const failures: RawAppointmentParseFailure[] = [];

  json.forEach((data, idx) => {
    const rowNumber = headerRowIndex + idx + 2;
    const row = normalizeExcelHeaders(data);
    const jalaliRaw = persianToEnglishDigits(getRowString(row, 'تاریخ'));
    const customerName = resolveRawCustomerName(row);
    const employeeShareRaw = getRowString(row, 'دریافت', 'دریافت کارمند');
    const sharePercentRaw = getRowString(row, 'درصد', 'درصد دریافت');
    const employeeName = getRowString(row, 'کارمند');
    const priceRaw = getRowString(row, 'قیمت', ' قیمت');
    const serviceRaw = getRowString(row, 'نام', 'نام خدمات');
    const invoiceId = getRowString(row, 'فاکتور');

    const date = parseJalaliDateAppointments(jalaliRaw);
    const totalPriceRial = parseAmountRial(priceRaw);
    const employeeShareRial = parseAmountRial(employeeShareRaw) ?? 0n;
    const customerPhone = resolveRawCustomerPhone(row);
    const serviceTrimmed = serviceRaw.trim();

    const missing: string[] = [];
    if (!jalaliRaw.trim()) missing.push('empty_date');
    if (jalaliRaw.trim() && !date) missing.push('invalid_date');
    if (!totalPriceRial) missing.push('invalid_price');
    if (!serviceTrimmed) missing.push('empty_service');
    if (!employeeName.trim()) missing.push('empty_employee');

    if (missing.length) {
      failures.push({
        rowNumber,
        reason: missing.join(','),
        jalaliDateRaw: jalaliRaw || undefined,
      });
      return;
    }

    rows.push({
      sourceFile,
      rowNumber,
      jalaliDateRaw: jalaliRaw,
      jalaliDateKey: date!.jalaliDateKey,
      customerPhone,
      customerName,
      employeeShareRial,
      sharePercent: parseSharePercent(sharePercentRaw),
      employeeName,
      employeePhone: resolveRawEmployeePhone(employeeName),
      totalPriceRial: totalPriceRial!,
      serviceNameRaw: serviceTrimmed,
      serviceNameCanonical: resolveServiceName(serviceTrimmed),
      invoiceId: invoiceId || undefined,
    });
  });

  return {
    rows,
    failures,
    headerRowIndex,
    totalDataRows: json.length,
    format: 'raw-services-export',
  };
}

export function parseRawAppointmentWorkbookFromBuffer(
  buffer: Buffer,
  sourceFile: string,
): RawAppointmentParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return parseRawServicesSheet(sheet, sourceFile);
}

export function parseRawAppointmentWorkbookFromPath(filePath: string): RawAppointmentParseResult {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const buffer = fs.readFileSync(filePath);
  return parseRawAppointmentWorkbookFromBuffer(buffer, path.basename(filePath));
}

export function buildAppointmentDateGroupPreview(
  parsedRows: ParsedAppointmentRow[],
  skippedMatchedDays: SkippedMatchedDay[],
  dbCountByJalaliDate: Map<string, number>,
  duplicateRowNumbers: Set<number>,
): AppointmentDateGroupPreview[] {
  const byDate = new Map<string, ParsedAppointmentRow[]>();
  for (const row of parsedRows) {
    const list = byDate.get(row.jalaliDateKey) ?? [];
    list.push(row);
    byDate.set(row.jalaliDateKey, list);
  }

  const matchedKeys = new Set(skippedMatchedDays.map((d) => d.jalaliDateKey));
  const groups: AppointmentDateGroupPreview[] = [];

  for (const [jalaliDateKey, rows] of byDate.entries()) {
    const rowNumbers = rows.map((r) => r.rowNumber);
    const duplicateCount = rowNumbers.filter((n) => duplicateRowNumbers.has(n)).length;
    const excelRowCount = rows.length;
    const dbAppointmentCount = dbCountByJalaliDate.get(jalaliDateKey) ?? 0;
    groups.push({
      jalaliDateKey,
      jalaliDateRaw: rows[0]?.jalaliDateRaw ?? jalaliDateKey.replace(/-/g, '/'),
      rowCount: excelRowCount,
      excelRowCount,
      dbAppointmentCount,
      status: matchedKeys.has(jalaliDateKey) ? 'count_matched_skipped' : 'eligible',
      duplicateCount,
      rowNumbers,
    });
  }

  groups.sort((a, b) => a.jalaliDateKey.localeCompare(b.jalaliDateKey));
  return groups;
}

export type SerializedAppointmentRow = Omit<
  ParsedAppointmentRow,
  'employeeShareRial' | 'totalPriceRial'
> & {
  employeeShareRial: string;
  totalPriceRial: string;
};

export function serializeAppointmentRow(row: ParsedAppointmentRow): SerializedAppointmentRow {
  return {
    ...row,
    employeeShareRial: row.employeeShareRial.toString(),
    totalPriceRial: row.totalPriceRial.toString(),
  };
}

export function deserializeAppointmentRow(row: SerializedAppointmentRow): ParsedAppointmentRow {
  return {
    ...row,
    employeeShareRial: BigInt(row.employeeShareRial),
    totalPriceRial: BigInt(row.totalPriceRial),
  };
}
