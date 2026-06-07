import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyImport() {
  console.log('🔍 Verifying Import...\n');

  const total = await prisma.appointment.count();
  console.log(`📊 Total Appointments: ${total}`);

  const withCalendar = await prisma.appointment.count({
    where: { calendarDateId: { not: null } },
  });
  console.log(`✅ With calendar_date_id: ${withCalendar} (${((withCalendar/total)*100).toFixed(1)}%)`);

  // Sample appointment
  const sample = await prisma.appointment.findFirst({
    include: {
      calendarDate: true,
      customer: { include: { user: true } },
      employee: { include: { user: true } },
    },
    orderBy: { id: 'desc' },
  });

  if (sample) {
    console.log('\n📝 Sample Appointment (Last):');
    console.log(`   ID: ${sample.id}`);
    console.log(`   Customer: ${sample.customer.user.name}`);
    console.log(`   Employee: ${sample.employee?.user.name || 'N/A'}`);
    console.log(`   Date: ${sample.calendarDate?.jalaliDate} (${sample.calendarDate?.gregorianDate?.toISOString().split('T')[0]})`);
    console.log(`   Time: ${sample.scheduledAt.toISOString()}`);
    console.log(`   Amount: ${sample.amount} Rials`);
    console.log(`   Status: ${sample.status}`);
  }

  // Date range
  const minDate = await prisma.appointment.findFirst({
    orderBy: { scheduledAt: 'asc' },
    select: { scheduledAt: true, calendarDate: true },
    include: { calendarDate: true },
  });

  const maxDate = await prisma.appointment.findFirst({
    orderBy: { scheduledAt: 'desc' },
    select: { scheduledAt: true, calendarDate: true },
    include: { calendarDate: true },
  });

  console.log('\n📅 Date Range:');
  console.log(`   From: ${minDate?.calendarDate?.jalaliDate} (${minDate?.scheduledAt.toISOString().split('T')[0]})`);
  console.log(`   To: ${maxDate?.calendarDate?.jalaliDate} (${maxDate?.scheduledAt.toISOString().split('T')[0]})`);

  console.log('\n✅ Import verification complete!');

  await prisma.$disconnect();
}

verifyImport();
