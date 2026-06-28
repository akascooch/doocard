import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  GENERIC_IMPORT_CUSTOMER_NAME,
  GENERIC_IMPORT_CUSTOMER_PHONE,
  NOTES_KEY_PREFIX,
  ParsedAppointmentRow,
  computeConservativeAppointmentDedupKey,
  parseJalaliDateAppointments,
} from './appointment-workbook.parser';

export const SOURCE_TYPE_APPT = 'EXCEL_IMPORT:APPOINTMENTS';
export const DEFAULT_SERVICE_DURATION_MIN = 60;
export const DEFAULT_IMPORT_PASSWORD = 'excel-import-no-login';

export type ServiceRef = { serviceId: number; durationMinutes: number };

export function externalRefAppointment(batchId: string, dedupKey: string): string {
  return `${SOURCE_TYPE_APPT}:${batchId}:${dedupKey}`;
}

export async function hashImportPassword(): Promise<string> {
  return bcrypt.hash(DEFAULT_IMPORT_PASSWORD, 10);
}

/** Count non-deleted appointments per Jalali calendar date key. */
export async function getAppointmentCountsByJalaliDates(
  prisma: PrismaClient,
  jalaliDateKeys: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const key of jalaliDateKeys) {
    counts.set(key, 0);
  }
  if (!jalaliDateKeys.length) return counts;

  const calendarDates = await prisma.calendarDate.findMany({
    where: { jalaliDate: { in: jalaliDateKeys } },
    select: { id: true, jalaliDate: true },
  });
  if (!calendarDates.length) return counts;

  const calendarIdToJalali = new Map(calendarDates.map((cd) => [cd.id, cd.jalaliDate]));
  const grouped = await prisma.appointment.groupBy({
    by: ['calendarDateId'],
    where: {
      deletedAt: null,
      calendarDateId: { in: calendarDates.map((cd) => cd.id) },
    },
    _count: { id: true },
  });

  for (const row of grouped) {
    if (row.calendarDateId == null) continue;
    const jalali = calendarIdToJalali.get(row.calendarDateId);
    if (jalali) counts.set(jalali, row._count.id);
  }

  return counts;
}

export async function ensureGenericImportCustomer(prisma: PrismaClient): Promise<void> {
  const phone = GENERIC_IMPORT_CUSTOMER_PHONE;
  const existing = await prisma.user.findUnique({
    where: { phone },
    include: { customer: true },
  });
  if (existing?.customer) return;

  if (existing && !existing.customer) {
    await prisma.customer.create({ data: { userId: existing.id } });
    return;
  }

  const user = await prisma.user.create({
    data: {
      name: GENERIC_IMPORT_CUSTOMER_NAME,
      phone,
      password: await hashImportPassword(),
      role: 'CUSTOMER',
    },
  });
  await prisma.customer.create({ data: { userId: user.id } });
}

export async function buildReferenceIndexes(prisma: PrismaClient) {
  const employees = await prisma.employee.findMany({
    include: { user: { select: { id: true, name: true, phone: true } } },
  });

  const employeesByPhone = new Map<
    string,
    { employeeId: number; userId: number; name: string; phone: string }
  >();
  const employeesByName = new Map<string, { employeeId: number; userId: number; phone: string }>();

  for (const e of employees) {
    const phone = normalizePhone(e.user.phone);
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
  const customersByPhone = new Map<
    string,
    { customerId: number; userId: number; name: string }
  >();
  for (const c of customers) {
    const phone = normalizePhone(c.user.phone);
    if (phone) {
      customersByPhone.set(phone, {
        customerId: c.id,
        userId: c.user.id,
        name: c.user.name,
      });
    }
  }

  const services = await prisma.service.findMany();
  const servicesByName = new Map<string, { id: number; name: string; durationMinutes: number }>();
  for (const s of services) {
    servicesByName.set(s.name.trim().toLowerCase(), {
      id: s.id,
      name: s.name,
      durationMinutes: s.durationMinutes,
    });
  }

  const calendarRows = await prisma.calendarDate.findMany({
    where: { jalaliYear: { gte: 1401, lte: 1405 } },
    select: { id: true, jalaliDate: true },
  });
  const calendarByJalali = new Map<string, number>();
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
    calendarByJalali,
    adminUserId: admin?.id ?? null,
    defaultBankAccountId: bank?.id ?? null,
  };
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let p = raw.replace(/[\s\-()]/g, '');
  if (p.startsWith('+98')) p = '0' + p.slice(3);
  else if (p.startsWith('98') && p.length === 12) p = '0' + p.slice(2);
  if (!/^09\d{9}$/.test(p)) return null;
  return p;
}

async function ensureCalendarDate(
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

  const jalaali = require('jalaali-js');
  const [jy, jm, jd] = jalaliDateKey.split('-').map(Number);
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
  const normalized = normalizePhone(phone);
  if (!normalized) throw new Error(`Invalid employee phone: ${phone}`);
  if (cache.has(normalized)) return cache.get(normalized)!;

  let user = await tx.user.findUnique({
    where: { phone: normalized },
    include: { employee: true },
  });
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

export interface AppointmentCommitResult {
  created: number;
  skippedDuplicate: number;
  failed: number;
}

export async function commitEligibleAppointmentRows(
  prisma: PrismaClient,
  batchId: string,
  rows: ParsedAppointmentRow[],
  options: { createMissing: boolean; createIncomeTx: boolean },
): Promise<AppointmentCommitResult> {
  const indexes = await buildReferenceIndexes(prisma);
  if (!indexes.adminUserId || !indexes.defaultBankAccountId) {
    throw new Error('Missing ADMIN or default BankAccount — cannot commit import');
  }

  const result: AppointmentCommitResult = { created: 0, skippedDuplicate: 0, failed: 0 };
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
  const calendarCache = new Map<string, number>(indexes.calendarByJalali);
  const seenDedupKeys = new Set<string>();
  const BATCH_SIZE = 100;
  const TX_OPTS = { maxWait: 30_000, timeout: 120_000 };

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const row of batch) {
        try {
          const dedupKey = computeConservativeAppointmentDedupKey(row, 0);

          if (seenDedupKeys.has(dedupKey) || (await appointmentExistsInDb(prisma, dedupKey))) {
            seenDedupKeys.add(dedupKey);
            result.skippedDuplicate++;
            continue;
          }
          seenDedupKeys.add(dedupKey);

          const date = parseJalaliDateAppointments(row.jalaliDateRaw);
          if (!date) {
            result.failed++;
            continue;
          }

          let calendarDateId = indexes.calendarByJalali.get(row.jalaliDateKey);
          if (!calendarDateId && options.createMissing) {
            calendarDateId = await ensureCalendarDate(prisma, row.jalaliDateKey, calendarCache);
          }
          if (!calendarDateId) {
            result.failed++;
            continue;
          }

          const c = await ensureCustomer(tx, row.customerPhone, row.customerName, customerCache);
          const e = await ensureEmployee(tx, row.employeePhone, row.employeeName, employeeCache);
          const svc = options.createMissing
            ? await ensureService(tx, row.serviceNameCanonical, row.totalPriceRial, serviceCache)
            : (() => {
                const hit = indexes.servicesByName.get(row.serviceNameCanonical.trim().toLowerCase());
                return hit
                  ? { serviceId: hit.id, durationMinutes: hit.durationMinutes }
                  : null;
              })();

          if (!svc) {
            result.failed++;
            continue;
          }

          const amount = row.totalPriceRial;
          const notes = [
            `${NOTES_KEY_PREFIX}${dedupKey}`,
            `batch=${batchId}`,
            `employeeShareRial=${row.employeeShareRial.toString()}`,
            row.sharePercent != null ? `sharePercent=${row.sharePercent}` : null,
            `sourceRow=${row.rowNumber}`,
          ]
            .filter(Boolean)
            .join(' | ');

          const appointment = await tx.appointment.create({
            data: {
              customerId: c.customerId,
              employeeId: e.employeeId,
              serviceId: svc.serviceId,
              calendarDateId,
              scheduledAt: date.scheduledAt,
              durationMin: svc.durationMinutes,
              status: 'SETTLED',
              amount,
              accountId: indexes.defaultBankAccountId!,
              paidAt: date.scheduledAt,
              paidBy: indexes.adminUserId!,
              paymentMethod: 'CASH',
              notes,
              services: [
                {
                  serviceId: svc.serviceId,
                  serviceName: row.serviceNameCanonical,
                  priceAtBooking: Number(amount),
                  durationMin: svc.durationMinutes,
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

          if (options.createIncomeTx) {
            const extRef = externalRefAppointment(batchId, dedupKey);
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
                  occurredAt: date.scheduledAt,
                  createdBy: indexes.adminUserId!,
                  description: `درآمد نوبت تاریخی #${appointment.id}`,
                  meta: {
                    externalRef: extRef,
                    batchId,
                    sourceFile: row.sourceFile,
                    rowNumber: row.rowNumber,
                  },
                },
              });
              await tx.bankAccount.update({
                where: { id: indexes.defaultBankAccountId! },
                data: { balance: { increment: amount } },
              });
            }
          }

          result.created++;
        } catch {
          result.failed++;
        }
      }
    }, TX_OPTS);
  }

  return result;
}

export async function findExistingAppointmentDedupKeys(
  prisma: PrismaClient,
  keys: string[],
): Promise<Set<string>> {
  const existing = new Set<string>();
  for (const key of keys) {
    if (await appointmentExistsInDb(prisma, key)) {
      existing.add(key);
    }
  }
  return existing;
}
