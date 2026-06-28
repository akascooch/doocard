import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as jalaali from 'jalaali-js';
import { ParsedCustomerRow } from './customer-workbook.parser';

export const DEFAULT_CUSTOMER_IMPORT_PASSWORD = 'excel-import-no-login';

export async function hashCustomerImportPassword(): Promise<string> {
  return bcrypt.hash(DEFAULT_CUSTOMER_IMPORT_PASSWORD, 10);
}

export async function findExistingCustomerPhones(
  prisma: PrismaClient,
  phones: string[],
): Promise<Set<string>> {
  if (!phones.length) return new Set();
  const users = await prisma.user.findMany({
    where: { phone: { in: phones } },
    select: { phone: true },
  });
  return new Set(users.map((u) => u.phone));
}

function parseBirthdate(raw: string | null): Date | null {
  if (!raw?.trim()) return null;
  const normalized = raw.trim().replace(/-/g, '/');
  const parts = normalized.split('/').map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [jy, jm, jd] = parts;
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) return null;
  const g = jalaali.toGregorian(jy, jm, jd);
  return new Date(g.gy, g.gm - 1, g.gd);
}

export interface CustomerCommitResult {
  created: number;
  skippedExisting: number;
  skippedDuplicate: number;
  failed: number;
}

export async function commitEligibleCustomerRows(
  prisma: PrismaClient,
  rows: ParsedCustomerRow[],
): Promise<CustomerCommitResult> {
  const result: CustomerCommitResult = {
    created: 0,
    skippedExisting: 0,
    skippedDuplicate: 0,
    failed: 0,
  };
  const seenPhones = new Set<string>();

  for (const row of rows) {
    try {
      if (seenPhones.has(row.phone)) {
        result.skippedDuplicate++;
        continue;
      }
      seenPhones.add(row.phone);

      const existing = await prisma.user.findUnique({
        where: { phone: row.phone },
        include: { customer: true },
      });

      if (existing) {
        result.skippedExisting++;
        continue;
      }

      const user = await prisma.user.create({
        data: {
          name: row.name,
          phone: row.phone,
          email: row.email,
          password: await hashCustomerImportPassword(),
          role: 'CUSTOMER',
        },
      });

      await prisma.customer.create({
        data: {
          userId: user.id,
          birthdate: parseBirthdate(row.birthdateRaw),
          notes: row.notes,
        },
      });

      result.created++;
    } catch {
      result.failed++;
    }
  }

  return result;
}
