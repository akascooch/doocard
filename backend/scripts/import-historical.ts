/**
 * CRITICAL PRODUCTION IMPORT – Historical appointments from 1403.xlsx and 1404.xlsx.
 * Strict rules: employee must exist, service = اصلاح کامل | مانیکور, amount > 0.
 * All appointments → single public customer (09370504588).
 * scheduledAt = Jalali date + 12:00 Asia/Tehran (UTC).
 * Idempotency: invoice + date + employeeId.
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/import-historical.ts [--dry]
 * Requires: DATABASE_URL, Excel files 1403.xlsx and 1404.xlsx in project root.
 */
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
import * as jalaali from 'jalaali-js';
import * as ExcelJS from 'exceljs';
const XLSX = require('xlsx'); // fallback when ExcelJS returns empty sheets

const projectRoot = path.resolve(__dirname, '..', '..');
const PUBLIC_CUSTOMER_PHONE = '09370504588';
const PUBLIC_CUSTOMER_NAME = 'مشتری عمومی تاریخی';

// Only these services (DB names)
const ALLOWED_SERVICE_NAMES = ['اصلاح کامل', 'مانیکور'];
// Excel service name -> DB service name
const SERVICE_MAP: Record<string, string> = {
  'اصلاح': 'اصلاح کامل',
  'مانیکور': 'مانیکور',
};

const COL = { date: 0, mobile: 1, customerName: 2, received: 3, percent: 4, employee: 5, discount: 6, count: 7, price: 8, serviceName: 9, invoiceId: 10 };

// 12:00 Asia/Tehran = 08:30 UTC
const TEHRAN_NOON_UTC_HOUR = 8;
const TEHRAN_NOON_UTC_MINUTE = 30;

interface ParsedRow {
  date: string;
  received: string;
  employee: string;
  serviceName: string;
  invoiceId: string;
  sourceFile: string;
  rowIndex: number;
}

interface ImportStats {
  total_rows: number;
  imported: number;
  skipped: number;
  employee_not_found: number;
  service_not_mapped: number;
  duplicates: number;
  errors: number;
  errorDetails: Array<{ row: number; file: string; reason: string; raw?: ParsedRow }>;
}

function parseAmount(str: string): number {
  if (!str) return 0;
  const cleaned = String(str).replace(/,/g, '').replace(/\s/g, '').replace(/،/g, '');
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

function jalaliToUtcNoon(jalaliDate: string): Date | null {
  const normalized = jalaliDate.trim().replace(/-/g, '/');
  const parts = normalized.split('/').map(Number);
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(Date.UTC(g.gy, g.gm - 1, g.gd, TEHRAN_NOON_UTC_HOUR, TEHRAN_NOON_UTC_MINUTE, 0, 0));
}

function getCellXlsx(ws: any, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return '';
  let v = cell.v;
  if (v instanceof Date) v = v.toISOString();
  return (v != null ? String(v) : '').trim();
}

function parseWithXlsx(filePath: string): ParsedRow[] {
  const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
  const rows: ParsedRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    const ref = ws['!ref'];
    if (!ref) continue;
    const range = XLSX.utils.decode_range(ref);
    const headerRow = 1;
    for (let r = headerRow + 1; r <= range.e.r; r++) {
      rows.push({
        date: getCellXlsx(ws, r, COL.date),
        received: getCellXlsx(ws, r, COL.received),
        employee: getCellXlsx(ws, r, COL.employee),
        serviceName: getCellXlsx(ws, r, COL.serviceName),
        invoiceId: getCellXlsx(ws, r, COL.invoiceId),
        sourceFile: path.basename(filePath),
        rowIndex: r + 1,
      });
    }
  }
  return rows;
}

async function parseWithExcelJS(filePath: string): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheets: ExcelJS.Worksheet[] = [];
  workbook.eachSheet((ws) => sheets.push(ws));
  if (sheets.length === 0) return [];
  const rows: ParsedRow[] = [];
  for (const ws of sheets) {
    ws.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return; // title + header
      const get = (col: number) => {
        const c = row.getCell(col);
        let v = c.value;
        if (v != null && typeof v === 'object' && (v as any).text) v = (v as any).text;
        return (v != null ? String(v) : '').trim();
      };
      rows.push({
        date: get(COL.date + 1),
        received: get(COL.received + 1),
        employee: get(COL.employee + 1),
        serviceName: get(COL.serviceName + 1),
        invoiceId: get(COL.invoiceId + 1),
        sourceFile: path.basename(filePath),
        rowIndex: rowNumber,
      });
    });
  }
  return rows;
}

async function loadAllRows(): Promise<ParsedRow[]> {
  const files = [path.join(projectRoot, '1403.xlsx'), path.join(projectRoot, '1404.xlsx')];
  let all: ParsedRow[] = [];
  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      process.exit(1);
    }
    let rows = await parseWithExcelJS(filePath);
    if (rows.length === 0) rows = parseWithXlsx(filePath);
    all = all.concat(rows);
  }
  return all;
}

function resolveService(excelServiceName: string): string | null {
  const trimmed = (excelServiceName || '').trim();
  if (ALLOWED_SERVICE_NAMES.includes(trimmed)) return trimmed;
  return SERVICE_MAP[trimmed] || null;
}

function resolveEmployee(excelName: string, dbEmployees: { id: number; name: string }[]): number | null {
  const trimmed = (excelName || '').trim();
  if (!trimmed || trimmed === 'کارمند') return null;
  const exact = dbEmployees.find((e) => e.name.trim() === trimmed);
  if (exact) return exact.id;
  const fuzzy = dbEmployees.find((e) => e.name.trim().startsWith(trimmed) || trimmed.startsWith(e.name.trim()));
  return fuzzy ? fuzzy.id : null;
}

async function ensurePublicCustomer(prisma: PrismaClient): Promise<{ customerId: number; userId: number }> {
  let user = await prisma.user.findUnique({ where: { phone: PUBLIC_CUSTOMER_PHONE }, include: { customer: true } });
  if (!user) {
    const hash = await require('bcrypt').hash('historical-import-no-login', 10);
    user = await prisma.user.create({
      data: {
        name: PUBLIC_CUSTOMER_NAME,
        phone: PUBLIC_CUSTOMER_PHONE,
        password: hash,
        role: 'CUSTOMER',
      },
      include: { customer: true },
    });
  }
  if (!user.customer) {
    const customer = await prisma.customer.create({
      data: { userId: user.id },
    });
    return { customerId: customer.id, userId: user.id };
  }
  return { customerId: user.customer.id, userId: user.id };
}

async function getAdminUserId(prisma: PrismaClient): Promise<number> {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { id: 'asc' } });
  if (!admin) throw new Error('No ADMIN user found. Create an admin first.');
  return admin.id;
}

async function getDefaultBankAccountId(prisma: PrismaClient): Promise<number> {
  const acc = await prisma.bankAccount.findFirst({ where: { isDefault: true, deletedAt: null } });
  if (!acc) throw new Error('No default bank account found.');
  return acc.id;
}

async function duplicateExists(
  prisma: PrismaClient,
  customerId: number,
  scheduledAt: Date,
  employeeId: number,
  invoiceId: string,
): Promise<boolean> {
  const dayStart = new Date(scheduledAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(scheduledAt);
  dayEnd.setUTCHours(23, 59, 59, 999);
  const key = `HISTORICAL_INVOICE:${invoiceId}`;
  const existing = await prisma.appointment.findFirst({
    where: {
      customerId,
      employeeId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      notes: { contains: key },
      deletedAt: null,
    },
  });
  return !!existing;
}

async function runDry(rows: ParsedRow[], prisma: PrismaClient): Promise<ImportStats> {
  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: { user: { select: { name: true } } },
  });
  const dbEmployees = employees.map((e) => ({ id: e.id, name: e.user.name }));
  const services = await prisma.service.findMany({ where: { name: { in: ALLOWED_SERVICE_NAMES } } });
  const serviceNameToId = new Map(services.map((s) => [s.name, s.id]));

  const stats: ImportStats = {
    total_rows: rows.length,
    imported: 0,
    skipped: 0,
    employee_not_found: 0,
    service_not_mapped: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: [],
  };

  const duplicateKeys = new Set<string>();

  for (const row of rows) {
    const amount = parseAmount(row.received);
    if (amount <= 0) {
      stats.skipped++;
      continue;
    }

    const employeeId = resolveEmployee(row.employee, dbEmployees);
    if (employeeId === null) {
      stats.employee_not_found++;
      stats.errorDetails.push({ row: row.rowIndex, file: row.sourceFile, reason: 'employee_not_found', raw: row });
      continue;
    }

    const resolvedService = resolveService(row.serviceName);
    if (!resolvedService) {
      stats.service_not_mapped++;
      stats.errorDetails.push({ row: row.rowIndex, file: row.sourceFile, reason: 'service_not_mapped', raw: row });
      continue;
    }

    const scheduledAt = jalaliToUtcNoon(row.date);
    if (!scheduledAt) {
      stats.errors++;
      stats.errorDetails.push({ row: row.rowIndex, file: row.sourceFile, reason: 'invalid_date', raw: row });
      continue;
    }

    const dupKey = `${row.invoiceId}|${row.date}|${employeeId}`;
    if (duplicateKeys.has(dupKey)) {
      stats.duplicates++;
      continue;
    }
    duplicateKeys.add(dupKey);
    stats.imported++;
  }

  return stats;
}

async function runImport(rows: ParsedRow[], prisma: PrismaClient, dry: boolean): Promise<ImportStats> {
  const stats: ImportStats = {
    total_rows: rows.length,
    imported: 0,
    skipped: 0,
    employee_not_found: 0,
    service_not_mapped: 0,
    duplicates: 0,
    errors: 0,
    errorDetails: [],
  };

  if (dry) return runDry(rows, prisma);

  const [publicCustomer, adminUserId, defaultAccountId] = await Promise.all([
    ensurePublicCustomer(prisma),
    getAdminUserId(prisma),
    getDefaultBankAccountId(prisma),
  ]);

  const employees = await prisma.employee.findMany({
    where: { isActive: true },
    include: { user: { select: { name: true } } },
  });
  const dbEmployees = employees.map((e) => ({ id: e.id, name: e.user.name }));
  const services = await prisma.service.findMany({ where: { name: { in: ALLOWED_SERVICE_NAMES } } });
  const serviceNameToId = new Map(services.map((s) => [s.name, s.id]));

  const BATCH_SIZE = 100;
  const toProcess: Array<{ row: ParsedRow; employeeId: number; serviceId: number; amount: bigint; scheduledAt: Date }> = [];

  for (const row of rows) {
    const amount = parseAmount(row.received);
    if (amount <= 0) {
      stats.skipped++;
      continue;
    }
    const employeeId = resolveEmployee(row.employee, dbEmployees);
    if (employeeId === null) {
      stats.employee_not_found++;
      stats.errorDetails.push({ row: row.rowIndex, file: row.sourceFile, reason: 'employee_not_found', raw: row });
      continue;
    }
    const resolvedService = resolveService(row.serviceName);
    if (!resolvedService) {
      stats.service_not_mapped++;
      stats.errorDetails.push({ row: row.rowIndex, file: row.sourceFile, reason: 'service_not_mapped', raw: row });
      continue;
    }
    const serviceId = serviceNameToId.get(resolvedService);
    if (!serviceId) {
      stats.service_not_mapped++;
      continue;
    }
    const scheduledAt = jalaliToUtcNoon(row.date);
    if (!scheduledAt) {
      stats.errors++;
      stats.errorDetails.push({ row: row.rowIndex, file: row.sourceFile, reason: 'invalid_date', raw: row });
      continue;
    }

    const exists = await duplicateExists(prisma, publicCustomer.customerId, scheduledAt, employeeId, row.invoiceId);
    if (exists) {
      stats.duplicates++;
      continue;
    }

    toProcess.push({ row, employeeId, serviceId, amount: BigInt(amount), scheduledAt });
  }

  const serviceIdToDuration = new Map(services.map((s) => [s.id, s.durationMinutes]));

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const item of batch) {
        const { row, employeeId, serviceId, amount, scheduledAt } = item;
        const durationMin = serviceIdToDuration.get(serviceId) ?? 60;
        const notes = `HISTORICAL_INVOICE:${row.invoiceId}`;

        const appointment = await tx.appointment.create({
          data: {
            customerId: publicCustomer.customerId,
            employeeId,
            serviceId,
            services: [{ serviceId, priceAtBooking: Number(amount), durationMin }] as any,
            scheduledAt,
            durationMin,
            status: 'SETTLED',
            amount,
            accountId: defaultAccountId,
            paidAt: scheduledAt,
            paidBy: adminUserId,
            notes,
          },
        });

        await tx.appointmentService.create({
          data: { appointmentId: appointment.id, serviceId, price: Number(amount) },
        });

        await tx.transaction.create({
          data: {
            type: 'INCOME',
            amount,
            sourceType: 'APPOINTMENT',
            sourceId: appointment.id,
            relatedId: appointment.id,
            accountId: defaultAccountId,
            occurredAt: scheduledAt,
            createdBy: adminUserId,
            description: `درآمد نوبت تاریخی #${appointment.id}`,
          },
        });

        await tx.bankAccount.update({
          where: { id: defaultAccountId },
          data: { balance: { increment: amount } },
        });
        stats.imported++;
      }
    });
  }

  return stats;
}

async function main() {
  const dry = process.argv.includes('--dry');
  if (dry) console.log('=== DRY RUN (no DB writes) ===\n');

  const prisma = new PrismaClient();
  const rows = await loadAllRows();
  console.log(`Loaded ${rows.length} rows from 1403.xlsx + 1404.xlsx`);

  const stats = await runImport(rows, prisma, dry);
  await prisma.$disconnect();

  console.log('\n--- Summary ---');
  console.log('total_rows:', stats.total_rows);
  console.log('imported:', stats.imported);
  console.log('skipped:', stats.skipped);
  console.log('employee_not_found:', stats.employee_not_found);
  console.log('service_not_mapped:', stats.service_not_mapped);
  console.log('duplicates:', stats.duplicates);
  console.log('errors:', stats.errors);

  const reportPath = path.join(__dirname, 'import-historical-error-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ summary: stats, errorDetails: stats.errorDetails }, null, 2), 'utf8');
  console.log('\nError report written to:', reportPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
