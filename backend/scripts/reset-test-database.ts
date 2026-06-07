import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const TEST_DATABASE_URL = 'postgresql://postgres:Lord7know$@localhost:5433/MOVA_TEST?schema=public';

async function resetTestDatabase() {
  console.log('🔄 Resetting MOVA_TEST database...');

  try {
    // 1. Create Prisma client for test database
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: TEST_DATABASE_URL,
        },
      },
    });

    // 2. Test database connection
    console.log('📡 Testing database connection...');
    await prisma.$connect();
    console.log('✅ Database connection successful');

    // 3. Clear all test data
    console.log('🧹 Clearing all test data...');
    await clearAllTestData(prisma);
    console.log('✅ All test data cleared');

    // 4. Run Prisma migrations to ensure schema is up to date
    console.log('🔄 Running Prisma migrations...');
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Migrations completed');

    // 5. Generate Prisma client
    console.log('🔨 Generating Prisma client...');
    execSync('npx prisma generate', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Prisma client generated');

    await prisma.$disconnect();
    console.log('🎉 MOVA_TEST database reset completed successfully!');

  } catch (error) {
    console.error('❌ Error resetting test database:', error);
    process.exit(1);
  }
}

async function clearAllTestData(prisma: PrismaClient) {
  // Clear data in correct order (respecting foreign key constraints)
  await prisma.tip.deleteMany();
  await prisma.salary.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.appointmentService.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.employeeService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.dayClosing.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.smsSettings.deleteMany();
  await prisma.smsTemplate.deleteMany();
  await prisma.homepageDetails.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
}

// Run the reset if this file is executed directly
if (require.main === module) {
  resetTestDatabase();
}

export { resetTestDatabase, clearAllTestData };
