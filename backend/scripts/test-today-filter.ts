import { PrismaClient } from '@prisma/client';
import * as jalaali from 'jalaali-js';

const prisma = new PrismaClient();

async function testTodayFilter() {
  console.log('=== Testing "Today" Filter ===\n');

  const now = new Date();
  console.log('Current Server Time:', now.toString());
  console.log('');

  // Test what "today" filter should be
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(now);
  const from = `${todayStr}T00:00:00`;
  const to = `${todayStr}T23:59:59`;

  console.log('Filter Parameters:');
  console.log('  from:', from);
  console.log('  to:', to);
  console.log('');

  // Query with "today" filter
  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt: {
        gte: new Date(from),
        lte: new Date(to),
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

  console.log(`Found ${appointments.length} appointments for TODAY\n`);

  if (appointments.length === 0) {
    console.log('⚠️  No appointments found for today!');
    console.log('');
    console.log('Checking appointments for yesterday (2025-10-19):');
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);
    
    const yesterdayAppointments = await prisma.appointment.findMany({
      where: {
        scheduledAt: {
          gte: new Date(`${yesterdayStr}T00:00:00`),
          lte: new Date(`${yesterdayStr}T23:59:59`),
        },
        deletedAt: null,
      },
    });
    
    console.log(`Found ${yesterdayAppointments.length} appointments for YESTERDAY (${yesterdayStr})`);
  } else {
    console.log('Appointments for TODAY:');
    console.log('───────────────────────────────────────');
    
    appointments.forEach((apt) => {
      const date = new Date(apt.scheduledAt);
      const { jy, jm, jd } = jalaali.toJalaali(
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate()
      );
      const jalaliDate = `${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`;
      
      console.log(`  ID: ${apt.id} | ${date.toLocaleTimeString()} | ${jalaliDate} | ${apt.customer?.user?.name} | ${apt.status}`);
    });
  }

  await prisma.$disconnect();
}

testTodayFilter().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

