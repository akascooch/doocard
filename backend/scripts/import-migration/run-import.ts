/**
 * Production historical import: Pays.xlsx + LASTDATTA.xlsx
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/import-migration/run-import.ts --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/import-migration/run-import.ts --commit
 *   npx ts-node -r tsconfig-paths/register scripts/import-migration/run-import.ts --commit --create-missing
 *   npx ts-node -r tsconfig-paths/register scripts/import-migration/run-import.ts --dry-run --pays-only
 *   npx ts-node -r tsconfig-paths/register scripts/import-migration/run-import.ts --commit --appointments-only --dedup=import-all
 *
 * Rollback:
 *   npx ts-node -r tsconfig-paths/register scripts/import-migration/rollback.ts --batch-id=<id> --dry-run
 *   npx ts-node -r tsconfig-paths/register scripts/import-migration/rollback.ts --batch-id=<id> --confirm
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  DEFAULT_APPT_PATH,
  DEFAULT_PAYS_PATH,
  DEFAULT_SERVICE_DURATION_MIN,
  NOTES_KEY_PREFIX,
  ParsedAppointmentRow,
  ParsedExpenseRow,
  SOURCE_TYPE_APPT,
  SOURCE_TYPE_PAYS,
  buildReferenceIndexes,
  computeAppointmentDedupKey,
  computeExpenseDedupKey,
  ensureCalendarDate,
  externalRefAppointment,
  externalRefExpense,
  hashImportPassword,
  normalizeIranianPhone,
  parseAmountRial,
  parseAppointmentRows,
  parseExpenseRows,
  parseJalaliDateAppointments,
  parseJalaliDateExpenses,
  resolveCalendarFromIndexes,
  resolveCategoryFromIndexes,
  resolveCustomerFromIndexes,
  resolveEmployeeFromIndexes,
  resolveServiceFromIndexes,
  sha1,
  ServiceRef,
} from './helpers';

const BATCH_SIZE = 100;
const TX_OPTS = { maxWait: 30_000, timeout: 120_000 };

type DedupMode = 'skip-exact' | 'import-all';

interface CliOptions {
  dryRun: boolean;
  commit: boolean;
  createMissing: boolean;
  paysOnly: boolean;
  appointmentsOnly: boolean;
  dedup: DedupMode;
  batchId: string;
  paysPath: string;
  apptPath: string;
  createIncomeTx: boolean;
}

interface RowFailure {
  file: string;
  rowNumber: number;
  reason: string;
  data?: Record<string, unknown>;
}

interface DryRunReport {
  batchId: string;
  generatedAt: string;
  mode: 'dry-run' | 'commit';
  options: CliOptions;
  prerequisites: {
    adminUserId: number | null;
    defaultBankAccountId: number | null;
    calendarDates1402_1405: number;
    ok: boolean;
    blockers: string[];
  };
  pays: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    unmappedCategories: string[];
    amountTotalRial: string;
    failures: RowFailure[];
  };
  appointments: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    unmappedServices: string[];
    unresolvedEmployees: string[];
    unresolvedCustomers: string[];
    missingCalendarDates: string[];
    amountTotalRial: string;
    failures: RowFailure[];
  };
  importResult?: ImportResult;
}

interface ImportResult {
  pays: { created: number; skippedDuplicate: number; failed: number };
  appointments: { created: number; skippedDuplicate: number; failed: number };
  incomeTransactions: number;
  expenseTransactions: number;
}

function parseCli(): CliOptions {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const dryRun = !commit || args.includes('--dry-run');
  const dedupArg = args.find((a) => a.startsWith('--dedup='));
  const dedup = (dedupArg?.split('=')[1] as DedupMode) || 'skip-exact';
  const batchArg = args.find((a) => a.startsWith('--batch-id='));
  const batchId = batchArg?.split('=')[1] || `excel-migration-${Date.now()}`;

  return {
    dryRun: dryRun && !commit,
    commit,
    createMissing: args.includes('--create-missing'),
    paysOnly: args.includes('--pays-only'),
    appointmentsOnly: args.includes('--appointments-only'),
    dedup: dedup === 'import-all' ? 'import-all' : 'skip-exact',
    batchId,
    paysPath: process.env.PAYS_XLSX_PATH || DEFAULT_PAYS_PATH,
    apptPath: process.env.APPT_XLSX_PATH || DEFAULT_APPT_PATH,
    createIncomeTx: !args.includes('--skip-income-tx'),
  };
}

function countDuplicates<T>(items: T[], keyFn: (item: T, index: number) => string): {
  duplicateRows: number;
  keyCounts: Map<string, number>;
} {
  const keyCounts = new Map<string, number>();
  for (let i = 0; i < items.length; i++) {
    const k = keyFn(items[i], i);
    keyCounts.set(k, (keyCounts.get(k) || 0) + 1);
  }
  let duplicateRows = 0;
  for (const c of keyCounts.values()) {
    if (c > 1) duplicateRows += c - 1;
  }
  return { duplicateRows, keyCounts };
}

async function validateAndReport(
  prisma: PrismaClient,
  opts: CliOptions,
  expenseRows: ParsedExpenseRow[],
  appointmentRows: ParsedAppointmentRow[],
): Promise<DryRunReport> {
  const indexes = await buildReferenceIndexes(prisma);
  const blockers: string[] = [];
  if (!indexes.adminUserId) blockers.push('No ADMIN user found');
  if (!indexes.defaultBankAccountId) blockers.push('No default BankAccount found');
  if (indexes.calendarByJalali.size < 100) {
    blockers.push(
      `calendar_dates sparse for 1402-1405 (found ${indexes.calendarByJalali.size}); run prisma:seed or use --create-missing`,
    );
  }

  const paysFailures: RowFailure[] = [];
  const apptFailures: RowFailure[] = [];
  const unmappedCategories = new Set<string>();
  let paysValid = 0;
  let paysAmount = 0n;

  for (const row of expenseRows) {
    let ok = true;
    const reasons: string[] = [];
    if (!resolveCategoryFromIndexes(indexes, row.groupName)) {
      if (!opts.createMissing) {
        unmappedCategories.add(row.groupName);
        ok = false;
        reasons.push('category_unmapped');
      }
    }
    if (!indexes.defaultBankAccountId) {
      ok = false;
      reasons.push('no_default_bank_account');
    }
    if (!indexes.adminUserId) {
      ok = false;
      reasons.push('no_admin_user');
    }
    if (ok) {
      paysValid++;
      paysAmount += row.amountRial;
    } else {
      paysFailures.push({
        file: row.sourceFile,
        rowNumber: row.rowNumber,
        reason: reasons.join(','),
      });
    }
  }

  const unmappedServices = new Set<string>();
  const unresolvedEmployees = new Set<string>();
  const unresolvedCustomers = new Set<string>();
  const missingCalendarDates = new Set<string>();
  let apptValid = 0;
  let apptAmount = 0n;

  for (const row of appointmentRows) {
    let ok = true;
    const reasons: string[] = [];

    if (!resolveCalendarFromIndexes(indexes, row.jalaliDateKey) && !opts.createMissing) {
      missingCalendarDates.add(row.jalaliDateKey);
      reasons.push('calendar_date_missing');
      ok = false;
    }
    if (!resolveCustomerFromIndexes(indexes, row.customerPhone) && !opts.createMissing) {
      unresolvedCustomers.add(row.customerPhone);
      reasons.push('customer_unresolved');
      ok = false;
    }
    if (!resolveEmployeeFromIndexes(indexes, row.employeePhone, row.employeeName) && !opts.createMissing) {
      unresolvedEmployees.add(`${row.employeeName}|${row.employeePhone}`);
      reasons.push('employee_unresolved');
      ok = false;
    }
    if (!resolveServiceFromIndexes(indexes, row.serviceNameCanonical) && !opts.createMissing) {
      unmappedServices.add(row.serviceNameCanonical);
      reasons.push('service_unresolved');
      ok = false;
    }

    if (ok) {
      apptValid++;
      apptAmount += row.totalPriceRial;
    } else {
      apptFailures.push({
        file: row.sourceFile,
        rowNumber: row.rowNumber,
        reason: reasons.join(','),
        data: {
          employee: row.employeeName,
          service: row.serviceNameCanonical,
          date: row.jalaliDateKey,
        },
      });
    }
  }

  const paysDup = countDuplicates(expenseRows, (r, i) => {
    if (opts.dedup !== 'import-all') {
      return computeExpenseDedupKey(r, 0);
    }
    const baseKey = sha1(
      [r.groupName, r.amountRial.toString(), r.jalaliDateKey, r.description ?? ''].join('|'),
    );
    let occurrence = 0;
    for (let j = 0; j < i; j++) {
      const other = expenseRows[j];
      const otherBase = sha1(
        [other.groupName, other.amountRial.toString(), other.jalaliDateKey, other.description ?? ''].join('|'),
      );
      if (otherBase === baseKey) occurrence++;
    }
    return computeExpenseDedupKey(r, occurrence);
  });
  const apptDup = countDuplicates(appointmentRows, (r, i) =>
    computeAppointmentDedupKey(r, opts.dedup === 'import-all' ? i : 0),
  );

  return {
    batchId: opts.batchId,
    generatedAt: new Date().toISOString(),
    mode: opts.dryRun ? 'dry-run' : 'commit',
    options: opts,
    prerequisites: {
      adminUserId: indexes.adminUserId,
      defaultBankAccountId: indexes.defaultBankAccountId,
      calendarDates1402_1405: indexes.calendarByJalali.size,
      ok: blockers.length === 0 || opts.createMissing,
      blockers,
    },
    pays: {
      totalRows: expenseRows.length,
      validRows: paysValid,
      invalidRows: expenseRows.length - paysValid,
      duplicateRows: paysDup.duplicateRows,
      unmappedCategories: [...unmappedCategories],
      amountTotalRial: paysAmount.toString(),
      failures: paysFailures,
    },
    appointments: {
      totalRows: appointmentRows.length,
      validRows: apptValid,
      invalidRows: appointmentRows.length - apptValid,
      duplicateRows: apptDup.duplicateRows,
      unmappedServices: [...unmappedServices],
      unresolvedEmployees: [...unresolvedEmployees],
      unresolvedCustomers: [...unresolvedCustomers],
      missingCalendarDates: [...missingCalendarDates].slice(0, 50),
      amountTotalRial: apptAmount.toString(),
      failures: apptFailures.slice(0, 200),
    },
  };
}

async function ensureCategory(
  tx: Prisma.TransactionClient,
  name: string,
  cache: Map<string, number>,
): Promise<number> {
  const key = name.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const existing = await tx.transactionCategory.findFirst({
    where: { name: { equals: name.trim(), mode: 'insensitive' }, type: 'EXPENSE', deletedAt: null },
  });
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }
  const created = await tx.transactionCategory.create({
    data: { name: name.trim(), type: 'EXPENSE' },
  });
  cache.set(key, created.id);
  return created.id;
}

async function ensureService(
  tx: Prisma.TransactionClient,
  canonicalName: string,
  priceRial: bigint,
  cache: Map<string, ServiceRef>,
): Promise<ServiceRef> {
  const key = canonicalName.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  const existing = await tx.service.findFirst({
    where: { name: { equals: canonicalName.trim(), mode: 'insensitive' } },
  });
  if (existing) {
    const val: ServiceRef = { serviceId: existing.id, durationMinutes: existing.durationMinutes };
    cache.set(key, val);
    return val;
  }
  const created = await tx.service.create({
    data: {
      name: canonicalName.trim(),
      price: Number(priceRial),
      durationMinutes: DEFAULT_SERVICE_DURATION_MIN,
    },
  });
  const val: ServiceRef = { serviceId: created.id, durationMinutes: created.durationMinutes };
  cache.set(key, val);
  return val;
}

async function ensureCustomer(
  tx: Prisma.TransactionClient,
  phone: string,
  name: string,
  cache: Map<string, { customerId: number; userId: number }>,
): Promise<{ customerId: number; userId: number }> {
  if (cache.has(phone)) return cache.get(phone)!;
  let user = await tx.user.findUnique({ where: { phone }, include: { customer: true } });
  if (!user) {
    user = await tx.user.create({
      data: {
        name: name.trim() || 'مشتری',
        phone,
        password: await hashImportPassword(),
        role: 'CUSTOMER',
      },
      include: { customer: true },
    });
  }
  if (!user.customer) {
    const customer = await tx.customer.create({ data: { userId: user.id } });
    const val = { customerId: customer.id, userId: user.id };
    cache.set(phone, val);
    return val;
  }
  const val = { customerId: user.customer.id, userId: user.id };
  cache.set(phone, val);
  return val;
}

async function ensureEmployee(
  tx: Prisma.TransactionClient,
  phone: string,
  name: string,
  cache: Map<string, { employeeId: number; userId: number }>,
): Promise<{ employeeId: number; userId: number }> {
  const normalized = normalizeIranianPhone(phone);
  if (!normalized) throw new Error(`Invalid employee phone: ${phone}`);
  if (cache.has(normalized)) return cache.get(normalized)!;

  let user = await tx.user.findUnique({ where: { phone: normalized }, include: { employee: true } });
  if (!user) {
    user = await tx.user.create({
      data: {
        name: name.trim() || 'کارمند',
        phone: normalized,
        password: await hashImportPassword(),
        role: 'EMPLOYEE',
      },
      include: { employee: true },
    });
  }
  if (!user.employee) {
    const employee = await tx.employee.create({ data: { userId: user.id, isActive: true } });
    const val = { employeeId: employee.id, userId: user.id };
    cache.set(normalized, val);
    return val;
  }
  const val = { employeeId: user.employee.id, userId: user.id };
  cache.set(normalized, val);
  return val;
}

async function expenseExists(prisma: PrismaClient, externalRef: string): Promise<boolean> {
  const hit = await prisma.transaction.findFirst({
    where: {
      deletedAt: null,
      meta: { path: ['externalRef'], equals: externalRef },
    },
    select: { id: true },
  });
  return !!hit;
}

async function appointmentExistsInDb(prisma: PrismaClient, dedupKey: string): Promise<boolean> {
  const hit = await prisma.appointment.findFirst({
    where: {
      deletedAt: null,
      notes: { contains: `${NOTES_KEY_PREFIX}${dedupKey}` },
    },
    select: { id: true },
  });
  return !!hit;
}

/** skip-exact: in-memory Set catches same-batch dupes; DB lookup handles reruns/idempotency. */
async function shouldSkipExactAppointmentDuplicate(
  prisma: PrismaClient,
  dedupKey: string,
  seenInRun: Set<string>,
): Promise<boolean> {
  if (seenInRun.has(dedupKey)) return true;
  if (await appointmentExistsInDb(prisma, dedupKey)) {
    seenInRun.add(dedupKey);
    return true;
  }
  return false;
}

async function runImport(
  prisma: PrismaClient,
  opts: CliOptions,
  expenseRows: ParsedExpenseRow[],
  appointmentRows: ParsedAppointmentRow[],
): Promise<ImportResult> {
  const indexes = await buildReferenceIndexes(prisma);
  if (!indexes.adminUserId || !indexes.defaultBankAccountId) {
    throw new Error('Missing ADMIN or default BankAccount — cannot commit import');
  }

  const result: ImportResult = {
    pays: { created: 0, skippedDuplicate: 0, failed: 0 },
    appointments: { created: 0, skippedDuplicate: 0, failed: 0 },
    incomeTransactions: 0,
    expenseTransactions: 0,
  };

  const categoryCache = new Map<string, number>(indexes.categoriesByName);
  const serviceCache = new Map<string, ServiceRef>();
  for (const [k, v] of indexes.servicesByName) {
    serviceCache.set(k, { serviceId: v.id, durationMinutes: v.durationMinutes });
  }
  const customerCache = new Map<string, { customerId: number; userId: number }>();
  for (const [phone, c] of indexes.customersByPhone) {
    customerCache.set(phone, { customerId: c.customerId, userId: c.userId });
  }
  const employeeCache = new Map<string, { employeeId: number; userId: number }>();
  for (const [phone, e] of indexes.employeesByPhone) {
    employeeCache.set(phone, { employeeId: e.employeeId, userId: e.userId });
  }

  const apptKeyOccurrence = new Map<string, number>();
  const paysKeyOccurrence = new Map<string, number>();
  const seenAppointmentDedupKeys = new Set<string>();

  const calendarCache = new Map<string, number>(indexes.calendarByJalali);

  // --- Expenses ---
  for (let i = 0; i < expenseRows.length; i += BATCH_SIZE) {
    const batch = expenseRows.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        try {
          const paysBaseKey = sha1(
            [
              row.groupName,
              row.amountRial.toString(),
              row.jalaliDateKey,
              row.description ?? '',
            ].join('|'),
          );
          const paysOccurrence = paysKeyOccurrence.get(paysBaseKey) || 0;
          paysKeyOccurrence.set(paysBaseKey, paysOccurrence + 1);

          const dedupKey =
            opts.dedup === 'import-all'
              ? computeExpenseDedupKey(row, paysOccurrence)
              : computeExpenseDedupKey(row, 0);

          const extRef = externalRefExpense(opts.batchId, dedupKey);
          if (opts.dedup === 'skip-exact' && (await expenseExists(prisma, extRef))) {
            result.pays.skippedDuplicate++;
            continue;
          }

          const categoryId = await ensureCategory(tx, row.groupName, categoryCache);
          const date = parseJalaliDateExpenses(row.shamsiDateRaw);
          if (!date) {
            result.pays.failed++;
            continue;
          }

          let occurredAt = date.occurredAt;
          if (opts.dedup === 'import-all' && paysOccurrence > 0) {
            occurredAt = new Date(occurredAt.getTime() + paysOccurrence * 60_000);
          }

          await tx.transaction.create({
            data: {
              type: 'EXPENSE',
              amount: row.amountRial,
              currency: 'IRR',
              description: row.description,
              categoryId,
              accountId: indexes.defaultBankAccountId!,
              sourceType: SOURCE_TYPE_PAYS,
              paymentMethod: 'CASH',
              occurredAt,
              createdBy: indexes.adminUserId!,
              meta: {
                externalRef: extRef,
                batchId: opts.batchId,
                sourceFile: row.sourceFile,
                rowNumber: row.rowNumber,
                groupName: row.groupName,
                jalaliDate: row.jalaliDateKey,
              },
            },
          });

          await tx.bankAccount.update({
            where: { id: indexes.defaultBankAccountId! },
            data: { balance: { decrement: row.amountRial } },
          });

          result.pays.created++;
          result.expenseTransactions++;
        } catch {
          result.pays.failed++;
        }
      }
    }, TX_OPTS);
  }

  // --- Appointments ---
  for (let i = 0; i < appointmentRows.length; i += BATCH_SIZE) {
    const batch = appointmentRows.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        try {
          const baseKey = sha1(
            [
              row.jalaliDateKey,
              row.customerPhone,
              row.employeePhone,
              row.serviceNameCanonical,
              row.totalPriceRial.toString(),
              row.employeeShareRial.toString(),
            ].join('|'),
          );
          const occurrence = apptKeyOccurrence.get(baseKey) || 0;
          apptKeyOccurrence.set(baseKey, occurrence + 1);

          const dedupKey =
            opts.dedup === 'import-all'
              ? computeAppointmentDedupKey(row, occurrence)
              : computeAppointmentDedupKey(row, 0);

          if (
            opts.dedup === 'skip-exact' &&
            (await shouldSkipExactAppointmentDuplicate(prisma, dedupKey, seenAppointmentDedupKeys))
          ) {
            result.appointments.skippedDuplicate++;
            continue;
          }

          if (opts.dedup === 'skip-exact') {
            seenAppointmentDedupKeys.add(dedupKey);
          }

          const date = parseJalaliDateAppointments(row.jalaliDateRaw);
          if (!date) {
            result.appointments.failed++;
            continue;
          }

          let scheduledAt = date.scheduledAt;
          if (opts.dedup === 'import-all' && occurrence > 0) {
            scheduledAt = new Date(scheduledAt.getTime() + occurrence * 60_000);
          }

          let calendarDateId = resolveCalendarFromIndexes(indexes, row.jalaliDateKey);
          if (!calendarDateId && opts.createMissing) {
            calendarDateId = await ensureCalendarDate(prisma, row.jalaliDateKey, calendarCache);
          }
          if (!calendarDateId) {
            result.appointments.failed++;
            continue;
          }

          let customerId: number;
          let employeeId: number;

          if (opts.createMissing) {
            const c = await ensureCustomer(tx, row.customerPhone, row.customerName, customerCache);
            customerId = c.customerId;
            const e = await ensureEmployee(tx, row.employeePhone, row.employeeName, employeeCache);
            employeeId = e.employeeId;
          } else {
            const c = resolveCustomerFromIndexes(indexes, row.customerPhone);
            const e = resolveEmployeeFromIndexes(indexes, row.employeePhone, row.employeeName);
            if (!c || !e) {
              result.appointments.failed++;
              continue;
            }
            customerId = c.customerId;
            employeeId = e.employeeId;
          }

          const svc = opts.createMissing
            ? await ensureService(tx, row.serviceNameCanonical, row.totalPriceRial, serviceCache)
            : resolveServiceFromIndexes(indexes, row.serviceNameCanonical);
          if (!svc) {
            result.appointments.failed++;
            continue;
          }

          const durationMin = svc.durationMinutes;
          const amount = row.totalPriceRial;
          const notes = [
            `${NOTES_KEY_PREFIX}${dedupKey}`,
            `batch=${opts.batchId}`,
            `employeeShareRial=${row.employeeShareRial.toString()}`,
            row.sharePercent != null ? `sharePercent=${row.sharePercent}` : null,
            `sourceRow=${row.rowNumber}`,
          ]
            .filter(Boolean)
            .join(' | ');

          const appointment = await tx.appointment.create({
            data: {
              customerId,
              employeeId,
              serviceId: svc.serviceId,
              calendarDateId,
              scheduledAt,
              durationMin,
              status: 'SETTLED',
              amount,
              accountId: indexes.defaultBankAccountId!,
              paidAt: scheduledAt,
              paidBy: indexes.adminUserId!,
              paymentMethod: 'CASH',
              notes,
              services: [
                {
                  serviceId: svc.serviceId,
                  serviceName: row.serviceNameCanonical,
                  priceAtBooking: Number(amount),
                  durationMin,
                },
              ] as Prisma.InputJsonValue,
            },
          });

          await tx.appointmentService.create({
            data: {
              appointmentId: appointment.id,
              serviceId: svc.serviceId,
              price: Number(amount),
            },
          });

          if (opts.createIncomeTx) {
            const extRef = externalRefAppointment(opts.batchId, dedupKey);
            const existingIncome = await tx.transaction.findFirst({
              where: { meta: { path: ['externalRef'], equals: extRef }, deletedAt: null },
            });
            if (!existingIncome) {
              await tx.transaction.create({
                data: {
                  type: 'INCOME',
                  amount,
                  currency: 'IRR',
                  sourceType: 'APPOINTMENT',
                  sourceId: appointment.id,
                  relatedId: appointment.id,
                  accountId: indexes.defaultBankAccountId!,
                  occurredAt: scheduledAt,
                  createdBy: indexes.adminUserId!,
                  description: `درآمد نوبت تاریخی #${appointment.id}`,
                  meta: {
                    externalRef: extRef,
                    batchId: opts.batchId,
                    sourceFile: row.sourceFile,
                    rowNumber: row.rowNumber,
                  },
                },
              });
              await tx.bankAccount.update({
                where: { id: indexes.defaultBankAccountId! },
                data: { balance: { increment: amount } },
              });
              result.incomeTransactions++;
            }
          }

          result.appointments.created++;
        } catch {
          result.appointments.failed++;
        }
      }
    }, TX_OPTS);
  }

  return result;
}

async function main() {
  const opts = parseCli();
  console.log('=== Excel Historical Migration ===');
  console.log('batchId:', opts.batchId);
  console.log('mode:', opts.dryRun ? 'DRY-RUN' : 'COMMIT');
  console.log('dedup:', opts.dedup);
  console.log('createMissing:', opts.createMissing);
  console.log('paysPath:', opts.paysPath);
  console.log('apptPath:', opts.apptPath);

  const prisma = new PrismaClient();
  const reportDir = path.join(__dirname, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });

  try {
    let expenseRows: ParsedExpenseRow[] = [];
    let appointmentRows: ParsedAppointmentRow[] = [];

    if (!opts.appointmentsOnly) {
      console.log('\nReading Pays.xlsx...');
      expenseRows = parseExpenseRows(opts.paysPath);
      console.log(`  parsed ${expenseRows.length} expense rows`);
    }
    if (!opts.paysOnly) {
      console.log('Reading 1402-1405.xlsx...');
      appointmentRows = parseAppointmentRows(opts.apptPath);
      console.log(`  parsed ${appointmentRows.length} appointment rows`);
    }

    const report = await validateAndReport(prisma, opts, expenseRows, appointmentRows);

    if (opts.commit) {
      if (!report.prerequisites.ok && !opts.createMissing) {
        console.error('\n❌ Prerequisites failed. Fix blockers or use --create-missing where appropriate.');
        console.error(report.prerequisites.blockers);
        process.exit(1);
      }
      if (report.appointments.unmappedServices.length && !opts.createMissing) {
        console.error('\n❌ Unmapped services:', report.appointments.unmappedServices);
        process.exit(1);
      }

      const adminId = report.prerequisites.adminUserId!;
      await prisma.importJob.create({
        data: {
          userId: adminId,
          entity: 'EXCEL_MIGRATION',
          filename: `${path.basename(opts.paysPath)} + ${path.basename(opts.apptPath)}`,
          batchId: opts.batchId,
          totalRows: expenseRows.length + appointmentRows.length,
          status: 'RUNNING',
          startedAt: new Date(),
          metadata: {
            dedup: opts.dedup,
            createMissing: opts.createMissing,
            createIncomeTx: opts.createIncomeTx,
          },
        },
      });

      report.importResult = await runImport(prisma, opts, expenseRows, appointmentRows);

      await prisma.importJob.update({
        where: { batchId: opts.batchId },
        data: {
          status: 'COMPLETED',
          created: (report.importResult.pays.created || 0) + (report.importResult.appointments.created || 0),
          failed: (report.importResult.pays.failed || 0) + (report.importResult.appointments.failed || 0),
          finishedAt: new Date(),
          metadata: {
            dedup: opts.dedup,
            createMissing: opts.createMissing,
            createIncomeTx: opts.createIncomeTx,
            importResult: JSON.parse(JSON.stringify(report.importResult)),
          } as Prisma.InputJsonValue,
        },
      });
    }

    const reportPath = path.join(reportDir, `${opts.batchId}-${opts.dryRun ? 'dry-run' : 'commit'}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n--- SUMMARY ---');
    console.log(JSON.stringify(report, null, 2));
    console.log(`\nReport saved: ${reportPath}`);

    if (opts.dryRun) {
      console.log('\n✅ Dry-run complete. Review report, then run with --commit');
    } else {
      console.log('\n✅ Import committed.');
      console.log(`Rollback: npx ts-node -r tsconfig-paths/register scripts/import-migration/rollback.ts --batch-id=${opts.batchId} --dry-run`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
