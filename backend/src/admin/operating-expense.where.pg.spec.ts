import * as fs from 'fs';
import * as path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  accountingExpenseWhere,
  isOperatingExpense,
  OperatingExpenseFixture,
  PAYROLL_WITHDRAWAL_CATEGORY_CODES,
  PAYROLL_WITHDRAWAL_SOURCE_TYPES,
} from './operating-expense.where';

/**
 * Localhost-only PostgreSQL proof that the operating-expense predicate is NULL-safe.
 * Every row is written inside one interactive transaction that is always rolled back.
 * Skips when DATABASE_URL is missing or not loopback. Never prints the URL.
 */
function localhostDatabaseUrl(): string | null {
  const fromEnv = process.env.DATABASE_URL || readDotEnvDatabaseUrl();
  if (!fromEnv) return null;
  if (!/@localhost[:/]/i.test(fromEnv) && !/@127\.0\.0\.1[:/]/.test(fromEnv)) {
    return null;
  }
  return fromEnv;
}

function readDotEnvDatabaseUrl(): string | null {
  try {
    const text = fs.readFileSync(path.join(__dirname, '../../.env'), 'utf8');
    const match = text.match(/^DATABASE_URL\s*=\s*(.+)$/m);
    if (!match) return null;
    let raw = match[1].trim();
    if (
      (raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'"))
    ) {
      raw = raw.slice(1, -1);
    }
    return raw;
  } catch {
    return null;
  }
}

const ROLLBACK = Symbol('rollback');
const localUrl = localhostDatabaseUrl();

/** The pre-fix predicate, kept here only to prove the NULL regression. */
function legacyNotOrWhere(): Prisma.TransactionWhereInput {
  return {
    type: 'EXPENSE',
    deletedAt: null,
    NOT: {
      OR: [
        { sourceType: { in: [...PAYROLL_WITHDRAWAL_SOURCE_TYPES] } },
        { category: { code: { in: [...PAYROLL_WITHDRAWAL_CATEGORY_CODES] } } },
        { sourceType: 'CHEQUE_LEAF', chequeLeaves: { some: { category: 'GUARANTEE' } } },
      ],
    },
  };
}

(localUrl ? describe : describe.skip)('operating expense predicate on PostgreSQL', () => {
  let prisma: PrismaClient;
  const stamp = `${Date.now()}`.slice(-8);

  beforeAll(async () => {
    process.env.DATABASE_URL = localUrl as string;
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function inRolledBackTx(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
    await prisma
      .$transaction(
        async (tx) => {
          await fn(tx);
          throw ROLLBACK;
        },
        { timeout: 30_000, maxWait: 10_000 },
      )
      .catch((err) => {
        if (err !== ROLLBACK) throw err;
      });
  }

  it('includes NULL-coded / uncategorized rows, excludes payroll + guarantee, and matches the JS classifier', async () => {
    await inRolledBackTx(async (tx) => {
      const codedCategory = async (code: string) =>
        (await tx.transactionCategory.findUnique({ where: { code } })) ??
        tx.transactionCategory.create({
          data: { name: `t-${code}-${stamp}`, code, type: 'EXPENSE', requiresEmployee: true },
        });

      const rent = await tx.transactionCategory.create({
        data: { name: `t-rent-${stamp}`, type: 'EXPENSE' },
      });
      const staffBonus = await tx.transactionCategory.create({
        data: { name: `t-staff-${stamp}`, type: 'EXPENSE', requiresEmployee: true },
      });
      const coded = await Promise.all(PAYROLL_WITHDRAWAL_CATEGORY_CODES.map(codedCategory));

      const bank = await tx.bankAccount.create({ data: { name: `t-bank-${stamp}` } });
      const book = await tx.chequebook.create({
        data: { bankAccountId: bank.id, startNumber: 1, endNumber: 2, leafCount: 2 },
      });

      const expected = new Map<number, bigint>();
      const all: number[] = [];
      const add = async (
        data: Prisma.TransactionUncheckedCreateInput,
        include: boolean,
      ) => {
        const row = await tx.transaction.create({ data });
        all.push(row.id);
        if (include) expected.set(row.id, BigInt(data.amount as bigint));
        return row;
      };

      await add({ type: 'EXPENSE', amount: 1_000n }, true);
      await add({ type: 'EXPENSE', amount: 2_000n, categoryId: rent.id, sourceType: 'EXCEL_IMPORT:PAYS' }, true);
      await add({ type: 'EXPENSE', amount: 3_000n, categoryId: rent.id, sourceType: 'MANUAL' }, true);
      await add({ type: 'EXPENSE', amount: 4_000n, categoryId: rent.id }, true);
      for (const cat of coded) {
        await add({ type: 'EXPENSE', amount: 50_000n, categoryId: cat.id, sourceType: 'MANUAL' }, false);
      }
      for (const st of PAYROLL_WITHDRAWAL_SOURCE_TYPES) {
        await add({ type: 'EXPENSE', amount: 60_000n, sourceType: st }, false);
      }
      await add({ type: 'EXPENSE', amount: 70_000n, categoryId: staffBonus.id }, false);
      const normalCheque = await add({ type: 'EXPENSE', amount: 5_000n, sourceType: 'CHEQUE_LEAF' }, true);
      const guaranteeCheque = await add({ type: 'EXPENSE', amount: 80_000n, sourceType: 'CHEQUE_LEAF' }, false);
      await tx.chequeLeaf.create({
        data: { chequebookId: book.id, leafNumber: 1, status: 'CLEARED', category: 'NORMAL', transactionId: normalCheque.id },
      });
      await tx.chequeLeaf.create({
        data: { chequebookId: book.id, leafNumber: 2, status: 'CLEARED', category: 'GUARANTEE', transactionId: guaranteeCheque.id },
      });
      await add({ type: 'INCOME', amount: 90_000n }, false);
      await add({ type: 'TRANSFER', amount: 90_000n, sourceType: 'TRANSFER' }, false);
      await add({ type: 'EXPENSE', amount: 90_000n, deletedAt: new Date() }, false);

      const scoped = (where: Prisma.TransactionWhereInput): Prisma.TransactionWhereInput => ({
        AND: [where, { id: { in: all } }],
      });

      const kept = await tx.transaction.findMany({
        where: scoped(accountingExpenseWhere()),
        select: { id: true },
      });
      expect(new Set(kept.map((r) => r.id))).toEqual(new Set(expected.keys()));

      const agg = await tx.transaction.aggregate({
        where: scoped(accountingExpenseWhere()),
        _sum: { amount: true },
      });
      const expectedTotal = [...expected.values()].reduce((a, b) => a + b, 0n);
      expect(agg._sum.amount).toBe(expectedTotal);
      expect(expectedTotal).toBe(15_000n);

      const rows = await tx.transaction.findMany({
        where: { id: { in: all } },
        include: { category: true, chequeLeaves: { select: { category: true } } },
      });
      expect(rows).toHaveLength(all.length);
      const sqlKept = new Set(kept.map((r) => r.id));
      const mismatches: Array<{ id: number; sql: boolean; js: boolean }> = [];
      let classifierTotal = 0n;
      for (const r of rows) {
        const js = isOperatingExpense({
          type: r.type,
          deletedAt: r.deletedAt,
          sourceType: r.sourceType,
          categoryCode: r.category?.code ?? null,
          categoryRequiresEmployee: r.category?.requiresEmployee ?? null,
          chequeCategory: (r.chequeLeaves[0]?.category ?? null) as OperatingExpenseFixture['chequeCategory'],
        });
        if (js) classifierTotal += r.amount;
        if (js !== sqlKept.has(r.id)) mismatches.push({ id: r.id, sql: sqlKept.has(r.id), js });
      }
      expect(mismatches).toEqual([]);
      expect(classifierTotal).toBe(agg._sum.amount);

      const nullShapes = rows.filter((r) => sqlKept.has(r.id));
      expect(nullShapes.some((r) => r.categoryId === null && r.sourceType === null)).toBe(true);
      expect(nullShapes.some((r) => r.category && r.category.code === null && r.sourceType === null)).toBe(true);
      expect(nullShapes.some((r) => r.category && r.category.code === null && r.sourceType !== null)).toBe(true);

      const legacy = await tx.transaction.findMany({
        where: scoped(legacyNotOrWhere()),
        select: { id: true },
      });
      expect(legacy.length).toBeLessThan(kept.length);
    });
  });
});
