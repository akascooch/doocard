import { PrismaClient } from '@prisma/client';
import * as jalaali from 'jalaali-js';

const prisma = new PrismaClient();

async function checkAppointments() {
  console.log('=== Checking Appointments Database ===\n');

  // Get all appointments from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: {
        gte: sevenDaysAgo,
      },
      deletedAt: null,
    },
    include: {
      customer: {
        include: {
          user: true,
        },
      },
      employee: {
        include: {
          user: true,
        },
      },
    },
    orderBy: {
      scheduledAt: 'asc',
    },
  });

  console.log(`Found ${appointments.length} appointments\n`);

  // Group by date
  const groupedByDate: Record<string, any[]> = {};

  appointments.forEach((apt) => {
    const date = new Date(apt.scheduledAt);
    const gregorianDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    // Convert to Jalali
    const { jy, jm, jd } = jalaali.toJalaali(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate()
    );
    const jalaliDate = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;

    if (!groupedByDate[gregorianDate]) {
      groupedByDate[gregorianDate] = [];
    }

    groupedByDate[gregorianDate].push({
      id: apt.id,
      scheduledAt: apt.scheduledAt,
      gregorianDate,
      jalaliDate,
      customer: apt.customer?.user?.name || 'Unknown',
      employee: apt.employee?.user?.name || 'Unknown',
      status: apt.status,
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    });
  });

  // Display grouped by date
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ Appointments Grouped by Date                                    │');
  console.log('└─────────────────────────────────────────────────────────────────┘\n');

  Object.keys(groupedByDate).sort().forEach((gregorianDate) => {
    const apts = groupedByDate[gregorianDate];
    const jalaliDate = apts[0].jalaliDate;
    
    console.log(`📅 ${gregorianDate} (${jalaliDate}) - ${apts.length} appointments:`);
    console.log('───────────────────────────────────────────────────────────────');
    
    apts.forEach((apt) => {
      console.log(`  ID: ${apt.id} | ${apt.time} | ${apt.customer} → ${apt.employee} | ${apt.status}`);
    });
    console.log('');
  });

  // Today's info
  const today = new Date();
  const todayGregorian = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayJalali = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const todayJalaliStr = `${todayJalali.jy}/${String(todayJalali.jm).padStart(2, '0')}/${String(todayJalali.jd).padStart(2, '0')}`;

  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ Current System Date                                             │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log(`Server Date: ${today.toString()}`);
  console.log(`Gregorian: ${todayGregorian}`);
  console.log(`Jalali: ${todayJalaliStr}`);
  console.log('');

  // Count appointments by date
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│ Summary                                                         │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  Object.keys(groupedByDate).sort().forEach((gregorianDate) => {
    const count = groupedByDate[gregorianDate].length;
    const jalaliDate = groupedByDate[gregorianDate][0].jalaliDate;
    const isToday = gregorianDate === todayGregorian;
    console.log(`${isToday ? '👉 ' : '   '}${gregorianDate} (${jalaliDate}): ${count} appointments`);
  });

  await prisma.$disconnect();
}

checkAppointments().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

