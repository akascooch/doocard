/**
 * Read-only: print key Prisma table counts for Doocard local DB.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const p = new PrismaClient();
  const models = [
    'user',
    'employee',
    'customer',
    'appointment',
    'service',
    'bankAccount',
    'transaction',
    'customerDebt',
    'calendarDate',
    'smsTemplate',
    'chequeLeaf',
    'notification',
  ] as const;
  const exact: Record<string, number | string> = {};
  for (const m of models) {
    try {
      exact[m] = await (p as any)[m].count();
    } catch (e: any) {
      exact[m] = `ERR:${String(e?.message || e).slice(0, 80)}`;
    }
  }
  console.log(JSON.stringify(exact, null, 2));
  await p.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
