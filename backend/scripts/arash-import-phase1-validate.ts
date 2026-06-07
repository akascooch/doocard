/**
 * PHASE 1 – PRE-IMPORT VALIDATION (LOCAL ONLY)
 * NO DATA INSERTION. Validates employee, customer, services, and analyzes Excel.
 *
 * Employee: آرش بهمن, phone 09124081450
 * Customer: 09370504588
 * Services: Manicure, Pedicure
 * Excel: C:\Users\a.hosseini\Desktop\apk\backups\arash-data.xlsx
 *
 * Run: npx ts-node -r tsconfig-paths/register scripts/arash-import-phase1-validate.ts
 * Requires: DATABASE_URL pointing to LOCAL DB (e.g. localhost:5433/MOVA)
 */
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';
const XLSX = require('xlsx');

const EXCEL_PATH = 'C:\\Users\\a.hosseini\\Desktop\\apk\\backups\\arash-data.xlsx';
const EMPLOYEE_PHONE = '09124081450';
const CUSTOMER_PHONE = '09370504588';
/** Service IDs in DB: Pedicure=1, Manicure=4 */
const SERVICE_IDS = { Pedicure: 1, Manicure: 4 } as const;
/** Excel service name (Persian) → DB service id */
export const EXCEL_SERVICE_TO_ID: Record<string, number> = {
  پدیکور: 1,
  مانیکور: 4,
};

interface ValidationReport {
  phase: 'PHASE_1_PRE_IMPORT_VALIDATION';
  timestamp: string;
  database: string;
  employee: {
    found: boolean;
    userId?: number;
    employeeId?: number;
    name?: string;
    phone: string;
    role?: string;
    isActive?: boolean;
    error?: string;
  };
  customer: {
    found: boolean;
    userId?: number;
    customerId?: number;
    name?: string;
    phone: string;
    error?: string;
  };
  services: {
    found: boolean;
    items: Array<{ name: string; id: number; found: boolean }>;
    error?: string;
  };
  excel: {
    fileExists: boolean;
    filePath: string;
    sheetNames?: string[];
    columns?: string[];
    sampleRowCount: number;
    totalRows: number;
    dateRange?: { min: string; max: string };
    dateFormat: 'Jalali' | 'Gregorian' | 'Unknown' | 'Mixed';
    timeFormat?: string;
    amountColumn?: string;
    statusColumn?: string;
    invalidRows: number;
    missingServices: string[];
    duplicateRisk: 'low' | 'medium' | 'high' | 'unknown';
    scheduledAtMustBeComputed: boolean;
    rawSampleRows?: unknown[];
    error?: string;
  };
  summary: {
    readyForImport: boolean;
    blockReasons: string[];
  };
}

function getCell(ws: any, r: number, c: number): string {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = ws[addr];
  if (!cell) return '';
  let v = cell.v;
  if (v instanceof Date) v = (v as Date).toISOString();
  return (v != null ? String(v) : '').trim();
}

function analyzeExcel(filePath: string): ValidationReport['excel'] {
  const base: ValidationReport['excel'] = {
    fileExists: fs.existsSync(filePath),
    filePath,
    sampleRowCount: 0,
    totalRows: 0,
    dateFormat: 'Unknown',
    invalidRows: 0,
    missingServices: [],
    duplicateRisk: 'unknown',
    scheduledAtMustBeComputed: true,
  };

  if (!base.fileExists) {
    base.error = 'File not found';
    return base;
  }

  try {
    const workbook = XLSX.read(fs.readFileSync(filePath), { type: 'buffer', cellDates: true });
    base.sheetNames = workbook.SheetNames;

    const firstSheetName = workbook.SheetNames[0];
    const ws = workbook.Sheets[firstSheetName];
    const ref = ws['!ref'];
    if (!ref) {
      base.error = 'Sheet has no data range';
      return base;
    }

    const range = XLSX.utils.decode_range(ref);
    const headerRow = 0;
    const dataStartRow = headerRow + 1;
    base.totalRows = Math.max(0, range.e.r - dataStartRow + 1);

    const colCount = range.e.c + 1;
    const headers: string[] = [];
    for (let c = 0; c < colCount; c++) {
      headers.push(getCell(ws, headerRow, c) || `Col_${c}`);
    }
    base.columns = headers;

    const sampleRows: unknown[] = [];
    const dateValues: string[] = [];
    let invalidCount = 0;
    const serviceNamesInSheet = new Set<string>();

    for (let r = dataStartRow; r <= range.e.r; r++) {
      const row: Record<string, string> = {};
      let hasDate = false;
      let dateStr = '';
      for (let c = 0; c < colCount; c++) {
        const key = headers[c] || `Col_${c}`;
        const val = getCell(ws, r, c);
        row[key] = val;
        if (val && (headers[c]?.toLowerCase().includes('date') || headers[c]?.toLowerCase().includes('تاریخ'))) {
          hasDate = true;
          dateStr = val;
        }
        if (val && (headers[c]?.toLowerCase().includes('service') || headers[c]?.toLowerCase().includes('خدمت') || headers[c] === 'نام')) {
          serviceNamesInSheet.add(val.trim());
        }
      }
      if (r - dataStartRow < 5) sampleRows.push(row);
      if (dateStr) dateValues.push(dateStr);
      if (!hasDate && Object.values(row).some(Boolean)) invalidCount++;
    }

    base.rawSampleRows = sampleRows;
    base.sampleRowCount = Math.min(5, base.totalRows);

    if (dateValues.length > 0) {
      const withSlash = dateValues.filter((d) => /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(d.replace(/\s/g, '')));
      const withJalali = dateValues.filter((d) => /^1[34]\d{2}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(d.replace(/\s/g, '')));
      if (withJalali.length > withSlash.length - withJalali.length) base.dateFormat = 'Jalali';
      else if (withSlash.length > 0) base.dateFormat = 'Gregorian';
    }

    const amountCol = headers.find((h) => h && (/\bamount\b|قیمت|مبلغ|received|price/i.test(h)));
    const statusCol = headers.find((h) => h && (/\bstatus\b|وضعیت|state/i.test(h)));
    const timeCol = headers.find((h) => h && (/\btime\b|ساعت|hour/i.test(h)));
    if (amountCol) base.amountColumn = amountCol;
    if (statusCol) base.statusColumn = statusCol;
    if (timeCol) base.timeFormat = timeCol;

    base.invalidRows = invalidCount;
    const requiredExcelNames = Object.keys(EXCEL_SERVICE_TO_ID);
    base.missingServices = requiredExcelNames.filter(
      (excelName) => !Array.from(serviceNamesInSheet).some((s) => s.trim() === excelName || s.includes(excelName))
    );
    if (base.missingServices.length === 0 && serviceNamesInSheet.size === 0) {
      base.missingServices = [];
    }

    const uniqueDates = new Set(dateValues);
    if (dateValues.length > 0 && uniqueDates.size / dateValues.length < 0.5) base.duplicateRisk = 'high';
    else if (base.totalRows > 100) base.duplicateRisk = 'medium';
    else base.duplicateRisk = 'low';

    if (dateValues.length > 0) {
      const sorted = dateValues.slice().sort();
      base.dateRange = { min: sorted[0], max: sorted[sorted.length - 1] };
    }
  } catch (e: any) {
    base.error = e?.message || String(e);
  }

  return base;
}

async function main() {
  const report: ValidationReport = {
    phase: 'PHASE_1_PRE_IMPORT_VALIDATION',
    timestamp: new Date().toISOString(),
    database: process.env.DATABASE_URL ? 'configured' : 'missing',
    employee: { found: false, phone: EMPLOYEE_PHONE },
    customer: { found: false, phone: CUSTOMER_PHONE },
    services: {
      found: false,
      items: [
        { name: 'Pedicure', id: SERVICE_IDS.Pedicure, found: false },
        { name: 'Manicure', id: SERVICE_IDS.Manicure, found: false },
      ],
    },
    excel: analyzeExcel(EXCEL_PATH),
    summary: { readyForImport: false, blockReasons: [] },
  };

  const prisma = new PrismaClient();

  try {
    const userEmployee = await prisma.user.findUnique({
      where: { phone: EMPLOYEE_PHONE },
      include: { employee: true },
    });
    if (userEmployee) {
      report.employee.found = true;
      report.employee.userId = userEmployee.id;
      report.employee.name = userEmployee.name;
      report.employee.role = userEmployee.role;
      if (userEmployee.employee) {
        report.employee.employeeId = userEmployee.employee.id;
        report.employee.isActive = userEmployee.employee.isActive;
      }
      if (userEmployee.role !== 'EMPLOYEE') report.summary.blockReasons.push('Employee user role is not EMPLOYEE');
      if (!userEmployee.employee) report.summary.blockReasons.push('Employee row missing for user');
      if (userEmployee.employee && !userEmployee.employee.isActive) report.summary.blockReasons.push('Employee is not active');
    } else {
      report.employee.error = 'User not found by phone ' + EMPLOYEE_PHONE;
      report.summary.blockReasons.push(report.employee.error);
    }
  } catch (e: any) {
    report.employee.error = e?.message || String(e);
    report.summary.blockReasons.push('DB error: ' + report.employee.error);
  }

  try {
    const userCustomer = await prisma.user.findUnique({
      where: { phone: CUSTOMER_PHONE },
      include: { customer: true },
    });
    if (userCustomer) {
      report.customer.found = true;
      report.customer.userId = userCustomer.id;
      report.customer.name = userCustomer.name;
      if (userCustomer.customer) report.customer.customerId = userCustomer.customer.id;
      else {
        report.summary.blockReasons.push('Customer row missing for user ' + CUSTOMER_PHONE);
      }
    } else {
      report.customer.error = 'User not found by phone ' + CUSTOMER_PHONE;
      report.summary.blockReasons.push(report.customer.error);
    }
  } catch (e: any) {
    report.customer.error = e?.message || String(e);
    report.summary.blockReasons.push('DB error: ' + report.customer.error);
  }

  try {
    const ids = [SERVICE_IDS.Pedicure, SERVICE_IDS.Manicure];
    const services = await prisma.service.findMany({ where: { id: { in: ids } } });
    for (const item of report.services.items) {
      const s = services.find((s) => s.id === item.id);
      item.found = !!s;
    }
    report.services.found = report.services.items.every((i) => i.found);
    if (!report.services.found) {
      report.summary.blockReasons.push(
        'Missing services by id: ' + report.services.items.filter((i) => !i.found).map((i) => `${i.name}(id=${i.id})`).join(', ')
      );
    }
  } catch (e: any) {
    report.services.error = e?.message || String(e);
    report.summary.blockReasons.push('DB error: ' + report.services.error);
  }

  if (!report.excel.fileExists) report.summary.blockReasons.push('Excel file not found');
  if (report.excel.error) report.summary.blockReasons.push('Excel error: ' + report.excel.error);

  report.summary.readyForImport =
    report.employee.found &&
    report.employee.role === 'EMPLOYEE' &&
    report.employee.employeeId != null &&
    report.employee.isActive === true &&
    report.customer.found === true &&
    report.customer.customerId != null &&
    report.services.found === true &&
    report.excel.fileExists === true &&
    !report.excel.error &&
    report.summary.blockReasons.length === 0;

  await prisma.$disconnect();

  const outPath = path.join(__dirname, 'arash-import-phase1-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log('\nReport written to:', outPath);
  console.log('\nReady for import:', report.summary.readyForImport);
  if (report.summary.blockReasons.length) console.log('Block reasons:', report.summary.blockReasons);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
