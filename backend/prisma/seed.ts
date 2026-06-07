import { PrismaClient } from '@prisma/client';
import jalaali from 'jalaali-js';

const prisma = new PrismaClient();

/**
 * Generate calendar_dates for range 2000-01-01 to 2050-12-31
 * This provides ~51 years of calendar data
 */
async function seedCalendarDates() {
  console.log('🗓️  Starting calendar_dates seed...\n');

  const startDate = new Date('2000-01-01');
  const endDate = new Date('2050-12-31');

  const calendarData: any[] = [];
  let currentDate = new Date(startDate);
  let count = 0;
  const batchSize = 1000;

  while (currentDate <= endDate) {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();

    // Convert to Jalali using jalaali-js
    const { jy, jm, jd } = jalaali.toJalaali(year, month, day);

    // Format Jalali date as YYYY-MM-DD
    const jalaliDate = `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;

    // Get day of week (0=Sunday, 6=Saturday)
    const gregorianDayOfWeek = currentDate.getDay();
    const jalaliDayOfWeek = gregorianDayOfWeek; // Same weekday

    // Get ISO week
    const isoWeek = getISOWeek(currentDate);

    // Create date at midnight UTC
    const gregorianDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    calendarData.push({
      gregorianDate,
      jalaliDate,
      gregorianDayOfWeek,
      jalaliDayOfWeek,
      isoWeek,
      gregorianYear: year,
      gregorianMonth: month,
      gregorianDay: day,
      jalaliYear: jy,
      jalaliMonth: jm,
      jalaliDay: jd,
    });

    count++;

    // Insert in batches to avoid memory issues
    if (calendarData.length >= batchSize) {
      await prisma.calendarDate.createMany({
        data: calendarData,
        skipDuplicates: true, // Idempotent
      });
      console.log(`✅ Inserted batch (${count} total dates processed)`);
      calendarData.length = 0; // Clear array
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Insert remaining records
  if (calendarData.length > 0) {
    await prisma.calendarDate.createMany({
      data: calendarData,
      skipDuplicates: true,
    });
    console.log(`✅ Inserted final batch (${count} total dates processed)`);
  }

  // Verify
  const totalCount = await prisma.calendarDate.count();
  console.log(`\n📊 Total calendar dates in database: ${totalCount}`);

  // Show sample
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayRecord = await prisma.calendarDate.findFirst({
    where: {
      gregorianDate: new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())),
    },
  });

  if (todayRecord) {
    console.log('\n📅 Today\'s calendar entry:');
    console.log(`   Gregorian: ${todayRecord.gregorianDate.toISOString().split('T')[0]}`);
    console.log(`   Jalali: ${todayRecord.jalaliDate}`);
    console.log(`   Day of week: ${getDayName(todayRecord.gregorianDayOfWeek)}`);
  }
}

/**
 * Get ISO week number for a date
 */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get day name for debugging
 */
function getDayName(dayNum: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNum];
}

/**
 * Main seed function
 */
async function main() {
  try {
    console.log('🌱 Starting database seed...\n');

    await seedCalendarDates();

    console.log('\n✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
