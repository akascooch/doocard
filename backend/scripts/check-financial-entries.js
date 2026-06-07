// اسکریپت بررسی آخرین تراکنش‌های مالی
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const entries = await prisma.financialEntry.findMany({
    orderBy: { id: 'desc' },
    take: 10,
    select: {
      id: true,
      amount: true,
      type: true,
      description: true,
      bankAccountId: true,
      categoryId: true,
      date: true,
    },
  });
  console.table(entries);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); }); 