/**
 * Print appointment counts (for production runbook pre/post import).
 * Run from backend: node scripts/count-appointments.js
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const total = await p.appointment.count();
  const u = await p.user.findUnique({
    where: { phone: '09124081450' },
    include: { employee: true },
  });
  const arashId = u?.employee?.id;
  const arashCount = arashId
    ? await p.appointment.count({ where: { employeeId: arashId } })
    : 0;
  const arashImportCount = arashId
    ? await p.appointment.count({
        where: {
          employeeId: arashId,
          notes: { contains: 'ARASH_IMPORT:' },
        },
      })
    : 0;
  const revenue =
    arashId
      ? await p.appointment.aggregate({
          where: {
            employeeId: arashId,
            notes: { contains: 'ARASH_IMPORT:' },
          },
          _sum: { amount: true },
        })
      : { _sum: { amount: null } };
  console.log('Total appointments:', total);
  console.log('Arash employeeId:', arashId ?? 'NOT_FOUND');
  console.log('Appointments for Arash:', arashCount);
  console.log('Arash ARASH_IMPORT count:', arashImportCount);
  console.log('Arash ARASH_IMPORT revenue (Rials):', revenue._sum.amount?.toString() ?? '0');
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
