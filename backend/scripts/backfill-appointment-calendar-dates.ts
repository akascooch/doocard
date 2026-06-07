import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Backfill calendar_date_id for existing appointments
 * Matches appointments by date(scheduled_at) to calendar_dates.gregorian_date
 */
async function backfillAppointmentCalendarDates() {
  console.log('🔄 Starting backfill of appointment calendar_date_id...\n');

  try {
    // Get all appointments without calendar_date_id
    const appointments = await prisma.appointment.findMany({
      where: {
        calendarDateId: null,
        deletedAt: null,
      },
      select: {
        id: true,
        scheduledAt: true,
      },
    });

    console.log(`📊 Found ${appointments.length} appointments to backfill\n`);

    if (appointments.length === 0) {
      console.log('✅ No appointments to backfill!');
      return;
    }

    let updated = 0;
    let failed = 0;
    const batchSize = 100;

    for (let i = 0; i < appointments.length; i += batchSize) {
      const batch = appointments.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}...`);

      for (const appointment of batch) {
        try {
          // Extract date from scheduled_at (UTC)
          const scheduledDate = new Date(appointment.scheduledAt);
          const gregorianDate = new Date(Date.UTC(
            scheduledDate.getUTCFullYear(),
            scheduledDate.getUTCMonth(),
            scheduledDate.getUTCDate(),
            0, 0, 0, 0
          ));

          // Find matching calendar date
          const calendarDate = await prisma.calendarDate.findFirst({
            where: {
              gregorianDate: gregorianDate,
            },
            select: {
              id: true,
              jalaliDate: true,
            },
          });

          if (calendarDate) {
            // Update appointment
            await prisma.appointment.update({
              where: { id: appointment.id },
              data: { calendarDateId: calendarDate.id },
            });
            updated++;
          } else {
            console.log(`⚠️  No calendar date found for appointment ${appointment.id} (${scheduledDate.toISOString()})`);
            failed++;
          }
        } catch (error) {
          console.error(`❌ Error processing appointment ${appointment.id}:`, error);
          failed++;
        }
      }

      console.log(`  ✅ Batch complete. Updated: ${updated}, Failed: ${failed}`);
    }

    console.log(`\n✅ Backfill complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Failed: ${failed}`);

    // Verify
    const remaining = await prisma.appointment.count({
      where: {
        calendarDateId: null,
        deletedAt: null,
      },
    });
    console.log(`\n📊 Appointments still without calendar_date_id: ${remaining}`);

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

backfillAppointmentCalendarDates()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

