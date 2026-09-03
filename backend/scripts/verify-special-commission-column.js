/* LOCAL READ-ONLY verification — no mutations */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    const cols = await p.$queryRawUnsafe(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'employees'
        AND column_name = 'isSpecialCommission'
    `);
    const withdrawal = await p.$queryRawUnsafe(`
      SELECT to_regclass('public.employee_withdrawal_requests')::text AS withdrawal_table
    `);
    const migrations = await p.$queryRawUnsafe(`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE migration_name LIKE '%special_commission%'
      ORDER BY finished_at DESC NULLS LAST
    `);
    console.log(
      JSON.stringify(
        {
          isSpecialCommissionColumn: cols,
          employee_withdrawal_requests: withdrawal,
          specialCommissionMigrations: migrations,
        },
        null,
        2,
      ),
    );
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
