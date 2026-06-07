/**
 * One-off: 1) Print current work_schedules. 2) Set all to 10:00-22:00 and dedupe to one row per (employeeId, weekday).
 * Run: npx ts-node -r tsconfig-paths/register scripts/fix-work-schedules-10-22.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== STEP 1: Current work_schedules ===');
  const before = await prisma.workSchedule.findMany({
    orderBy: [{ employeeId: 'asc' }, { weekday: 'asc' }, { startTime: 'asc' }],
    select: { id: true, employeeId: true, weekday: true, startTime: true, endTime: true },
  });
  console.table(before);

  console.log('\n=== STEP 2: Dedupe first (keep one row per employeeId, weekday), then update to 10:00-22:00 ===');
  const all = await prisma.workSchedule.findMany({
    orderBy: [{ employeeId: 'asc' }, { weekday: 'asc' }, { id: 'asc' }],
    select: { id: true, employeeId: true, weekday: true },
  });
  const keepIds = new Set<number>();
  let prevKey: string | null = null;
  for (const row of all) {
    const key = `${row.employeeId}-${row.weekday}`;
    if (prevKey !== key) keepIds.add(row.id);
    prevKey = key;
  }
  const toDelete = all.filter((r) => !keepIds.has(r.id)).map((r) => r.id);
  if (toDelete.length > 0) {
    const del = await prisma.workSchedule.deleteMany({ where: { id: { in: toDelete } } });
    console.log('Deleted duplicate rows:', del.count);
  } else {
    console.log('No duplicates to delete.');
  }

  console.log('\n=== Update all to 10:00-22:00 ===');
  const updated = await prisma.workSchedule.updateMany({
    data: { startTime: '10:00', endTime: '22:00' },
  });
  console.log('Updated rows:', updated.count);

  console.log('\n=== After: work_schedules ===');
  const after = await prisma.workSchedule.findMany({
    orderBy: [{ employeeId: 'asc' }, { weekday: 'asc' }],
    select: { employeeId: true, weekday: true, startTime: true, endTime: true },
  });
  console.table(after);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
