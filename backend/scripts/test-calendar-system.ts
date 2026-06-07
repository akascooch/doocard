import { PrismaClient } from '@prisma/client';
import jalaali from 'jalaali-js';

const prisma = new PrismaClient();

async function testCalendarSystem() {
  console.log('🧪 Testing Calendar System\n');

  try {
    // Test 1: Check calendar_dates count
    const totalDates = await prisma.calendarDate.count();
    console.log(`✅ Total calendar dates: ${totalDates}`);

    // Test 2: Get today's date
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0));
    
    const todayCalendar = await prisma.calendarDate.findFirst({
      where: { gregorianDate: todayUTC },
    });

    if (todayCalendar) {
      console.log(`✅ Today's calendar entry found:`);
      console.log(`   - Gregorian: ${todayCalendar.gregorianDate.toISOString().split('T')[0]}`);
      console.log(`   - Jalali: ${todayCalendar.jalaliDate}`);
      console.log(`   - Day of week: ${todayCalendar.gregorianDayOfWeek}`);
    } else {
      console.log(`❌ Today's calendar entry not found!`);
    }

    // Test 3: Test Jalali query
    const jalaliToday = jalaali.toJalaali(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const jalaliDateStr = `${jalaliToday.jy}-${String(jalaliToday.jm).padStart(2, '0')}-${String(jalaliToday.jd).padStart(2, '0')}`;
    
    const jalaliQuery = await prisma.calendarDate.findUnique({
      where: { jalaliDate: jalaliDateStr },
    });

    if (jalaliQuery) {
      console.log(`✅ Jalali query works: ${jalaliDateStr} → ${jalaliQuery.gregorianDate.toISOString().split('T')[0]}`);
    } else {
      console.log(`❌ Jalali query failed for: ${jalaliDateStr}`);
    }

    // Test 4: Check appointments with calendar_date_id
    const appointmentsWithCalendar = await prisma.appointment.count({
      where: { calendarDateId: { not: null } },
    });
    const totalAppointments = await prisma.appointment.count();
    
    console.log(`✅ Appointments with calendar_date_id: ${appointmentsWithCalendar} / ${totalAppointments}`);

    // Test 5: Sample appointment with calendar data
    const sampleAppointment = await prisma.appointment.findFirst({
      where: { calendarDateId: { not: null } },
      include: { calendarDate: true },
    });

    if (sampleAppointment) {
      console.log(`✅ Sample appointment with calendar:`);
      console.log(`   - ID: ${sampleAppointment.id}`);
      console.log(`   - Scheduled: ${sampleAppointment.scheduledAt.toISOString()}`);
      console.log(`   - Jalali: ${sampleAppointment.calendarDate?.jalaliDate || 'N/A'}`);
    }

    console.log(`\n🎉 Calendar system test completed!`);
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testCalendarSystem();

