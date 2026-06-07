/**
 * Post-import verification: count appointments 2024/2025, sum amount, default bank balance.
 * Run: node scripts/verify-historical-import.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*)::int as c FROM appointments WHERE EXTRACT(YEAR FROM "scheduledAt") IN (2024, 2025) AND "deletedAt" IS NULL'
  );
  const sum = await prisma.$queryRawUnsafe(
    'SELECT COALESCE(SUM(amount), 0) as s FROM appointments WHERE EXTRACT(YEAR FROM "scheduledAt") IN (2024, 2025) AND "deletedAt" IS NULL'
  );
  const bank = await prisma.$queryRawUnsafe(
    'SELECT id, name, balance FROM bank_accounts WHERE "isDefault" = true AND "deletedAt" IS NULL LIMIT 1'
  );
  console.log('--- POST IMPORT VERIFICATION ---');
  console.log('Appointments (2024/2025) COUNT:', count[0].c);
  console.log('Appointments (2024/2025) SUM (Rials):', sum[0].s ? String(sum[0].s) : '0');
  console.log('Default bank account:', bank[0] ? { id: bank[0].id, name: bank[0].name, balance: String(bank[0].balance) } : 'N/A');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
