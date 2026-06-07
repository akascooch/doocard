import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedWorkSchedules() {
  console.log('🕐 Seeding default work schedules...');

  // Get all employees
  const employees = await prisma.employee.findMany();

  if (employees.length === 0) {
    console.log('⚠️  No employees found. Skipping work schedule seed.');
    return;
  }

  // Default work schedule (Saturday to Thursday, 9-13 and 14-18)
  const defaultSchedule = [
    // Saturday (0)
    { weekday: 6, startTime: '09:00', endTime: '13:00' },
    { weekday: 6, startTime: '14:00', endTime: '18:00' },
    // Sunday (1)
    { weekday: 0, startTime: '09:00', endTime: '13:00' },
    { weekday: 0, startTime: '14:00', endTime: '18:00' },
    // Monday (2)
    { weekday: 1, startTime: '09:00', endTime: '13:00' },
    { weekday: 1, startTime: '14:00', endTime: '18:00' },
    // Tuesday (3)
    { weekday: 2, startTime: '09:00', endTime: '13:00' },
    { weekday: 2, startTime: '14:00', endTime: '18:00' },
    // Wednesday (4)
    { weekday: 3, startTime: '09:00', endTime: '13:00' },
    { weekday: 3, startTime: '14:00', endTime: '18:00' },
    // Thursday (5)
    { weekday: 4, startTime: '09:00', endTime: '13:00' },
    { weekday: 4, startTime: '14:00', endTime: '18:00' },
    // Friday (6) - Day off for most salons
  ];

  for (const employee of employees) {
    console.log(`📅 Creating schedule for employee ${employee.id}...`);

    for (const schedule of defaultSchedule) {
      await prisma.workSchedule.upsert({
        where: {
          employeeId_weekday_startTime: {
            employeeId: employee.id,
            weekday: schedule.weekday,
            startTime: schedule.startTime,
          },
        },
        update: {},
        create: {
          employeeId: employee.id,
          weekday: schedule.weekday,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isActive: true,
        },
      });
    }

    console.log(`✅ Schedule created for employee ${employee.id}`);
  }

  console.log('✅ Work schedules seeded successfully!');
}

seedWorkSchedules()
  .catch((e) => {
    console.error('❌ Error seeding work schedules:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

