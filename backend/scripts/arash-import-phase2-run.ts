/**
 * PHASE 2 – Arash historical import (LOCAL or PRODUCTION).
 * Employee: resolved by phone 09124081450. Customer: 09370504588.
 * Services: Pedicure=1, Manicure=4. No SMS, no push, no settlement transactions.
 *
 * Run: npx ts-node scripts/arash-import-phase2-run.ts
 * Env: DATABASE_URL (required), ARASH_EXCEL_PATH (optional, for production e.g. /var/www/doocard/backend/arash-data.xlsx)
 */
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import * as jalaali from 'jalaali-js';
const XLSX = require('xlsx');

const DEFAULT_EXCEL_LOCAL = 'C:\\Users\\a.hosseini\\Desktop\\apk\\backups\\arash-data.xlsx';
const EXCEL_PATH = process.env.ARASH_EXCEL_PATH || DEFAULT_EXCEL_LOCAL;
const CUSTOMER_PHONE = '09370504588';
const EMPLOYEE_PHONE = '09124081450';
const EXCEL_SERVICE_TO_ID: Record<string, number> = { پدیکور: 1, مانیکور: 4 };
const IDEMPOTENCY_PREFIX = 'ARASH_IMPORT:';
const TEHRAN_NOON_UTC_HOUR = 8;
const TEHRAN_NOON_UTC_MINUTE = 30;

const COL = { date: 0, employee: 1, price: 2, serviceName: 3 };

function getCell(ws: any, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return '';
  let v = cell.v;
  if (v instanceof Date) v = (v as Date).toISOString();
  return (v != null ? String(v) : '').trim();
}

function parseAmount(str: string): number {
  if (!str) return 0;
  const cleaned = String(str).replace(/,/g, '').replace(/\s/g, '').replace(/،/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

function jalaliToUtcNoon(jalaliStr: string): Date | null {
  const normalized = jalaliStr.trim().replace(/-/g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, TEHRAN_NOON_UTC_HOUR, TEHRAN_NOON_UTC_MINUTE, 0, 0));
}

function jalaliToGregorianDate(jalaliStr: string): Date | null {
  const normalized = jalaliStr.trim().replace(/-/g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, 0, 0, 0, 0));
}

function jalaliToYMD(jalaliStr: string): string {
  const normalized = jalaliStr.trim().replace(/-/g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length !== 3) return '';
  const [jy, jm, jd] = parts;
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

async function getOrCreateCalendarDate(prisma: PrismaClient, jalaliStr: string): Promise<number | null> {
  const ymd = jalaliToYMD(jalaliStr);
  if (!ymd) return null;
  const existing = await prisma.calendarDate.findUnique({ where: { jalaliDate: ymd } });
  if (existing) return existing.id;
  const greg = jalaliToGregorianDate(jalaliStr);
  if (!greg) return null;
  const year = greg.getUTCFullYear();
  const month = greg.getUTCMonth() + 1;
  const day = greg.getUTCDate();
  const { jy, jm, jd } = jalaali.toJalaali(year, month, day);
  const gregorianDayOfWeek = greg.getUTCDay();
  const isoWeek = getISOWeek(greg);
  const normalized = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const created = await prisma.calendarDate.create({
    data: {
      gregorianDate: normalized,
      jalaliDate: ymd,
      gregorianDayOfWeek,
      jalaliDayOfWeek: gregorianDayOfWeek,
      isoWeek,
      gregorianYear: year,
      gregorianMonth: month,
      gregorianDay: day,
      jalaliYear: jy,
      jalaliMonth: jm,
      jalaliDay: jd,
    },
  });
  return created.id;
}

function resolveServiceId(name: string): number | null {
  const t = (name || '').trim();
  if (EXCEL_SERVICE_TO_ID[t] != null) return EXCEL_SERVICE_TO_ID[t];
  for (const [key, id] of Object.entries(EXCEL_SERVICE_TO_ID)) {
    if (t.includes(key) || key.includes(t)) return id;
  }
  return null;
}

interface ParsedRow {
  date: string;
  employee: string;
  price: string;
  serviceName: string;
  rowIndex: number;
}

function loadRows(filePath: string): ParsedRow[] {
  if (!fs.existsSync(filePath)) return [];
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const rows: ParsedRow[] = [];
  const ws = workbook.Sheets[workbook.SheetNames[0]];
  const ref = ws['!ref'];
  if (!ref) return rows;
  const range = XLSX.utils.decode_range(ref);
  for (let r = 1; r <= range.e.r; r++) {
    rows.push({
      date: getCell(ws, r, COL.date),
      employee: getCell(ws, r, COL.employee),
      price: getCell(ws, r, COL.price),
      serviceName: getCell(ws, r, COL.serviceName),
      rowIndex: r + 1,
    });
  }
  return rows;
}

async function main() {
  const prisma = new PrismaClient();

  const [userCustomer, userEmployee] = await Promise.all([
    prisma.user.findUnique({ where: { phone: CUSTOMER_PHONE }, include: { customer: true } }),
    prisma.user.findUnique({ where: { phone: EMPLOYEE_PHONE }, include: { employee: true } }),
  ]);
  if (!userCustomer?.customer) {
    console.error('Customer not found for', CUSTOMER_PHONE);
    process.exit(1);
  }
  if (!userEmployee?.employee) {
    console.error('Employee not found for', EMPLOYEE_PHONE, '(آرش بهمن)');
    process.exit(1);
  }
  const customerId = userCustomer.customer.id;
  const employeeId = userEmployee.employee.id;
  console.log('Resolved customerId:', customerId, 'employeeId (آرش بهمن):', employeeId);

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error('Excel file not found:', EXCEL_PATH);
    console.error('On production set ARASH_EXCEL_PATH e.g. /var/www/doocard/backend/arash-data.xlsx');
    process.exit(1);
  }

  const services = await prisma.service.findMany({ where: { id: { in: [1, 4] } } });
  const serviceIdToDuration = new Map(services.map((s) => [s.id, s.durationMinutes]));

  const rows = loadRows(EXCEL_PATH);
  console.log('Total rows in Excel:', rows.length);

  let inserted = 0;
  let skipped = 0;
  const firstSamples: Array<{ row: ParsedRow; scheduledAt: string; serviceId: number; amount: number }> = [];
  const lastSamples: Array<{ row: ParsedRow; scheduledAt: string; serviceId: number; amount: number }> = [];
  const BATCH_SIZE = 50;

  const processed: Array<{ row: ParsedRow; scheduledAt: Date; serviceId: number; amount: bigint }> = [];

  for (const row of rows) {
    const amount = parseAmount(row.price);
    if (amount <= 0) {
      skipped++;
      continue;
    }
    const serviceId = resolveServiceId(row.serviceName);
    if (serviceId === null) {
      skipped++;
      continue;
    }
    const scheduledAt = jalaliToUtcNoon(row.date);
    if (!scheduledAt) {
      skipped++;
      continue;
    }
    if (!row.employee || !row.employee.includes('آرش')) {
      skipped++;
      continue;
    }
    processed.push({ row, scheduledAt, serviceId, amount: BigInt(amount) });
  }

  const dupKey = new Set<string>();
  for (let i = 0; i < processed.length; i++) {
    const { row, scheduledAt, serviceId, amount } = processed[i];
    const key = `${row.date}|${serviceId}|${amount}`;
    if (dupKey.has(key)) {
      skipped++;
      continue;
    }
    dupKey.add(key);

    const calendarDateId = await getOrCreateCalendarDate(prisma, row.date);
    const durationMin = serviceIdToDuration.get(serviceId) ?? 60;
    const notes = `${IDEMPOTENCY_PREFIX}${row.date}|${serviceId}|${amount}`;

    const existing = await prisma.appointment.findFirst({
      where: {
        customerId,
        employeeId,
        notes: { contains: notes },
        deletedAt: null,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const app = await tx.appointment.create({
        data: {
          customerId,
          employeeId,
          serviceId,
          amount,
          scheduledAt,
          durationMin,
          status: 'COMPLETED',
          deletedAt: null,
          notes,
          calendarDateId: calendarDateId ?? undefined,
          paidAt: scheduledAt,
          services: [{ serviceId, priceAtBooking: Number(amount), durationMin }] as any,
        },
      });
      await tx.appointmentService.create({
        data: { appointmentId: app.id, serviceId, price: Number(amount) },
      });
    });
    inserted++;
    const sample = { row, scheduledAt: scheduledAt.toISOString(), serviceId, amount: Number(amount) };
    if (firstSamples.length < 3) firstSamples.push(sample);
    lastSamples.push(sample);
    if (lastSamples.length > 3) lastSamples.shift();
  }

  const totalForEmployee = await prisma.appointment.count({
    where: { employeeId, deletedAt: null },
  });
  const revenueResult = await prisma.appointment.aggregate({
    where: { employeeId, notes: { contains: IDEMPOTENCY_PREFIX }, deletedAt: null },
    _sum: { amount: true },
  });

  console.log('\n--- Import result ---');
  console.log('Inserted:', inserted);
  console.log('Skipped:', skipped);
  console.log('First 3 samples:', JSON.stringify(firstSamples, null, 2));
  console.log('Last 3 samples:', JSON.stringify(lastSamples, null, 2));
  console.log('Total appointments for employee (آرش بهمن):', totalForEmployee);
  console.log('Revenue sum (imported rows):', revenueResult._sum.amount?.toString() ?? '0');

  const logPath = path.join(__dirname, 'arash-import-phase2-log.json');
  fs.writeFileSync(
    logPath,
    JSON.stringify(
      {
        inserted,
        skipped,
        totalRows: rows.length,
        totalForEmployee,
        revenueSum: revenueResult._sum.amount?.toString(),
        firstSamples,
        lastSamples,
        at: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );
  console.log('Log written to:', logPath);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
