import * as crypto from 'crypto';
import * as jalaali from 'jalaali-js';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/** 12:00 Asia/Tehran stored as UTC (matches import-historical.ts) */
export const TEHRAN_NOON_UTC_HOUR = 8;
export const TEHRAN_NOON_UTC_MINUTE = 30;

export const SOURCE_TYPE_PAYS = 'EXCEL_IMPORT:PAYS';
export const SOURCE_TYPE_APPT = 'EXCEL_IMPORT:APPOINTMENTS';
export const NOTES_KEY_PREFIX = 'EXCEL_IMPORT_KEY:';

export const DEFAULT_PAYS_PATH =
  process.env.PAYS_XLSX_PATH ||
  'C:/Users/a.hosseini/Desktop/apk/files/Pays.xlsx';
export const DEFAULT_APPT_PATH =
  process.env.APPT_XLSX_PATH ||
  'C:/Users/a.hosseini/Desktop/apk/files/1402-1405.xlsx';

/** Excel service name -> canonical DB service name */
export const SERVICE_ALIAS_MAP: Record<string, string> = {
  اصلاح: 'اصلاح کامل',
  'مانیکور و پدیکور': 'مانیکور و پدیکور',
};

export const DEFAULT_SERVICE_DURATION_MIN = 60;
export const DEFAULT_IMPORT_PASSWORD = 'excel-import-no-login';

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
}

export interface ParsedExpenseRow {
  sourceFile: string;
  rowNumber: number;
  groupName: string;
  amountRial: bigint;
  shamsiDateRaw: string;
  jalaliDateKey: string;
  description: string | null;
}

export function sha1(input: string): string {
  return crypto.createHash('sha1').update(input, 'utf8').digest('hex');
}

export function normalizeExcelHeaders(row: Record<string, unknown>): NormalizedRow {
  const out: NormalizedRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.trim();
    const v =
      value == null
        ? ''
        : typeof value === 'number'
          ? value
          : String(value).trim();
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

/**
 * Appointments file: YYYY/MM/DD (e.g. 1402/01/02)
 */
export function parseJalaliDateAppointments(raw: string): {
  jalaliDateKey: string;
  scheduledAt: Date;
} | null {
  if (!raw?.trim()) return null;
  const normalized = raw.trim().replace(/-/g, '/');
  const parts = normalized.split('/').map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;

  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;

  const g = jalaali.toGregorian(jy, jm, jd);
  const scheduledAt = new Date(
    Date.UTC(g.gy, g.gm - 1, g.gd, TEHRAN_NOON_UTC_HOUR, TEHRAN_NOON_UTC_MINUTE, 0, 0),
  );

  return {
    jalaliDateKey: formatJalaliKey(jy, jm, jd),
    scheduledAt,
  };
}

/**
 * Pays file: DD/MM/YYYY (e.g. 01/03/1404)
 */
export function parseJalaliDateExpenses(raw: string): {
  jalaliDateKey: string;
  occurredAt: Date;
} | null {
  if (!raw?.trim()) return null;
  const normalized = raw.trim().replace(/-/g, '/');
  const parts = normalized.split('/').map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;

  const [jd, jm, jy] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;

  const g = jalaali.toGregorian(jy, jm, jd);
  const occurredAt = new Date(
    Date.UTC(g.gy, g.gm - 1, g.gd, TEHRAN_NOON_UTC_HOUR, TEHRAN_NOON_UTC_MINUTE, 0, 0),
  );

  return {
    jalaliDateKey: formatJalaliKey(jy, jm, jd),
    occurredAt,
  };
}

export function resolveServiceName(raw: string): string {
  const trimmed = raw.trim();
  return SERVICE_ALIAS_MAP[trimmed] ?? trimmed;
}

export function computeExpenseDedupKey(row: ParsedExpenseRow): string {
  return sha1(
    [
      row.groupName,
      row.amountRial.toString(),
      row.jalaliDateKey,
      row.description ?? '',
    ].join('|'),
  );
}

export function computeAppointmentDedupKey(
  row: ParsedAppointmentRow,
  occurrenceIndex = 0,
): string {
  return sha1(
    [
      row.jalaliDateKey,
      row.customerPhone,
      row.employeePhone,
      row.serviceNameCanonical,
      row.totalPriceRial.toString(),
      row.employeeShareRial.toString(),
      String(occurrenceIndex),
    ].join('|'),
  );
}

export function externalRefExpense(batchId: string, dedupKey: string): string {
  return `${SOURCE_TYPE_PAYS}:${batchId}:${dedupKey}`;
}

export function externalRefAppointment(batchId: string, dedupKey: string): string {
  return `${SOURCE_TYPE_APPT}:${batchId}:${dedupKey}`;
}

export async function hashImportPassword(): Promise<string> {
  return bcrypt.hash(DEFAULT_IMPORT_PASSWORD, 10);
}

export type EmployeeIndex = Map<
  string,
  { employeeId: number; userId: number; name: string; phone: string }
>;
export type EmployeeNameIndex = Map<string, { employeeId: number; userId: number; phone: string }>;
export type CustomerIndex = Map<string, { customerId: number; userId: number; name: string }>;
export type ServiceIndex = Map<string, { id: number; name: string; durationMinutes: number }>;
export type CategoryIndex = Map<string, number>;
export type CalendarIndex = Map<string, number>;

export async function buildReferenceIndexes(prisma: PrismaClient): Promise<{
  employeesByPhone: EmployeeIndex;
  employeesByName: EmployeeNameIndex;
  customersByPhone: CustomerIndex;
  servicesByName: ServiceIndex;
  categoriesByName: CategoryIndex;
  calendarByJalali: CalendarIndex;
  adminUserId: number | null;
  defaultBankAccountId: number | null;
}> {
  const employees = await prisma.employee.findMany({
    include: { user: { select: { id: true, name: true, phone: true } } },
  });

  const employeesByPhone: EmployeeIndex = new Map();
  const employeesByName: EmployeeNameIndex = new Map();
  for (const e of employees) {
    const phone = normalizeIranianPhone(e.user.phone);
    if (phone) {
      employeesByPhone.set(phone, {
        employeeId: e.id,
        userId: e.user.id,
        name: e.user.name,
        phone,
      });
    }
    employeesByName.set(e.user.name.trim().toLowerCase(), {
      employeeId: e.id,
      userId: e.user.id,
      phone: e.user.phone,
    });
  }

  const customers = await prisma.customer.findMany({
    include: { user: { select: { id: true, name: true, phone: true } } },
  });
  const customersByPhone: CustomerIndex = new Map();
  for (const c of customers) {
    const phone = normalizeIranianPhone(c.user.phone);
    if (phone) {
      customersByPhone.set(phone, {
        customerId: c.id,
        userId: c.user.id,
        name: c.user.name,
      });
    }
  }

  const services = await prisma.service.findMany();
  const servicesByName: ServiceIndex = new Map();
  for (const s of services) {
    servicesByName.set(s.name.trim().toLowerCase(), {
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
    });
  }

  const categories = await prisma.transactionCategory.findMany({
    where: { deletedAt: null, type: 'EXPENSE' },
  });
  const categoriesByName: CategoryIndex = new Map();
  for (const c of categories) {
    categoriesByName.set(c.name.trim().toLowerCase(), c.id);
  }

  const calendarRows = await prisma.calendarDate.findMany({
    where: {
      jalaliYear: { gte: 1402, lte: 1405 },
    },
    select: { id: true, jalaliDate: true },
  });
  const calendarByJalali: CalendarIndex = new Map();
  for (const cd of calendarRows) {
    calendarByJalali.set(cd.jalaliDate, cd.id);
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  const bank = await prisma.bankAccount.findFirst({
    where: { isDefault: true, deletedAt: null },
    select: { id: true },
  });

  return {
    employeesByPhone,
    employeesByName,
    customersByPhone,
    servicesByName,
    categoriesByName,
    calendarByJalali,
    adminUserId: admin?.id ?? null,
    defaultBankAccountId: bank?.id ?? null,
  };
}

export function resolveEmployeeFromIndexes(
  indexes: Awaited<ReturnType<typeof buildReferenceIndexes>>,
  employeePhoneRaw: string,
  employeeNameRaw: string,
): { employeeId: number; userId: number; matchedBy: 'phone' | 'name' } | null {
  const phone = normalizeIranianPhone(employeePhoneRaw);
  if (phone) {
    const hit = indexes.employeesByPhone.get(phone);
    if (hit) return { employeeId: hit.employeeId, userId: hit.userId, matchedBy: 'phone' };
  }
  const nameKey = employeeNameRaw.trim().toLowerCase();
  if (nameKey) {
    const hit = indexes.employeesByName.get(nameKey);
    if (hit) return { employeeId: hit.employeeId, userId: hit.userId, matchedBy: 'name' };
    for (const [k, v] of indexes.employeesByName.entries()) {
      if (k.startsWith(nameKey) || nameKey.startsWith(k)) {
        return { employeeId: v.employeeId, userId: v.userId, matchedBy: 'name' };
      }
    }
  }
  return null;
}

export function resolveCustomerFromIndexes(
  indexes: Awaited<ReturnType<typeof buildReferenceIndexes>>,
  phoneRaw: string,
): { customerId: number; userId: number } | null {
  const phone = normalizeIranianPhone(phoneRaw);
  if (!phone) return null;
  const hit = indexes.customersByPhone.get(phone);
  if (!hit) return null;
  return { customerId: hit.customerId, userId: hit.userId };
}

export type ServiceRef = { serviceId: number; durationMinutes: number };

export function resolveServiceFromIndexes(
  indexes: Awaited<ReturnType<typeof buildReferenceIndexes>>,
  serviceNameCanonical: string,
): ServiceRef | null {
  const hit = indexes.servicesByName.get(serviceNameCanonical.trim().toLowerCase());
  if (!hit) return null;
  return { serviceId: hit.id, durationMinutes: hit.durationMinutes };
}

export function resolveCategoryFromIndexes(
  indexes: Awaited<ReturnType<typeof buildReferenceIndexes>>,
  groupName: string,
): number | null {
  return indexes.categoriesByName.get(groupName.trim().toLowerCase()) ?? null;
}

export async function ensureCalendarDate(
  prisma: PrismaClient,
  jalaliDateKey: string,
  cache: Map<string, number>,
): Promise<number> {
  if (cache.has(jalaliDateKey)) return cache.get(jalaliDateKey)!;
  const existing = await prisma.calendarDate.findUnique({
    where: { jalaliDate: jalaliDateKey },
    select: { id: true },
  });
  if (existing) {
    cache.set(jalaliDateKey, existing.id);
    return existing.id;
  }

  const [jy, jm, jd] = jalaliDateKey.split('-').map(Number);
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) {
    throw new Error(`Invalid jalali date key: ${jalaliDateKey}`);
  }
  const g = jalaali.toGregorian(jy, jm, jd);
  const gregorianDate = new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0));
  const gregorianDayOfWeek = gregorianDate.getUTCDay();

  const created = await prisma.calendarDate.create({
    data: {
      gregorianDate,
      jalaliDate: jalaliDateKey,
      gregorianDayOfWeek,
      jalaliDayOfWeek: gregorianDayOfWeek,
      gregorianYear: g.gy,
      gregorianMonth: g.gm,
      gregorianDay: g.gd,
      jalaliYear: jy,
      jalaliMonth: jm,
      jalaliDay: jd,
    },
  });
  cache.set(jalaliDateKey, created.id);
  return created.id;
}

export function resolveCalendarFromIndexes(
  indexes: Awaited<ReturnType<typeof buildReferenceIndexes>>,
  jalaliDateKey: string,
): number | null {
  return indexes.calendarByJalali.get(jalaliDateKey) ?? null;
}
