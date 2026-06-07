const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const countRows = await prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM appointments
      WHERE ("serviceId" IS NULL OR "employeeId" IS NULL)
        AND "deletedAt" IS NULL
    `;
    const sampleRows = await prisma.$queryRaw`
      SELECT id, "serviceId", "employeeId", status, "scheduledAt"
      FROM appointments
      WHERE ("serviceId" IS NULL OR "employeeId" IS NULL)
        AND "deletedAt" IS NULL
      LIMIT 50
    `;
    const schemaRows = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'appointments'
      ORDER BY ordinal_position
    `;

    console.log('INTEGRITY_COUNT', countRows[0].count);
    console.log('SAMPLE_ROWS', JSON.stringify(sampleRows, null, 2));
    console.log('SCHEMA_COLUMNS', schemaRows.length);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
