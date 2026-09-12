const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const products = await prisma.product.findMany({
    where: { name: { startsWith: 'E2E' } },
    select: { name: true, stock: true, isPriceVisible: true, isActive: true },
    orderBy: { name: 'asc' },
  });
  const activeCount = await prisma.product.count({ where: { isActive: true } });
  const service = await prisma.service.findFirst({
    where: { name: 'E2E Haircut' },
    select: { name: true, durationMinutes: true },
  });
  const employee = await prisma.employee.findFirst({
    where: { user: { name: 'E2E Barber' } },
    select: { isActive: true, user: { select: { name: true } } },
  });
  const customer = await prisma.user.findFirst({
    where: { name: 'E2E Customer' },
    select: { role: true, name: true },
  });
  const schedules = employee
    ? await prisma.workSchedule.count({
        where: { employee: { user: { name: 'E2E Barber' } }, isActive: true },
      })
    : 0;
  console.log(`e2e_products=${JSON.stringify(products)}`);
  console.log(`active_product_count=${activeCount}`);
  console.log(`e2e_service=${JSON.stringify(service)}`);
  console.log(`e2e_employee=${JSON.stringify(employee)}`);
  console.log(`e2e_customer_role=${customer?.role || 'missing'}`);
  console.log(`e2e_schedules=${schedules}`);
  await prisma.$disconnect();
  if (products.length < 3 || !service || !employee || !customer) process.exit(4);
})().catch(async (err) => {
  console.error(err instanceof Error ? err.message : 'verify-seed failed');
  try { await prisma.$disconnect(); } catch {}
  process.exit(1);
});
