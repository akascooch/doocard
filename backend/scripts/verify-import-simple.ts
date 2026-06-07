import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  const total = await prisma.appointment.count();
  const withCalendar = await prisma.appointment.count({
    where: { calendarDateId: { not: null } },
  });

  console.log('✅ Total Appointments:', total);
  console.log('✅ With calendar_date_id:', withCalendar);
  console.log('📈 Percentage:', ((withCalendar/total)*100).toFixed(1) + '%');

  await prisma.$disconnect();
}

verify();

