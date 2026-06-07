import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DATABASE_URL = 'postgresql://postgres:Lord7know$@localhost:5433/MOVA_TEST?schema=public';

async function setupTestDatabase() {
  console.log('🔧 Setting up MOVA_TEST database for testing...');

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

    // 3. Run Prisma migrations
    console.log('🔄 Running Prisma migrations...');
    process.env.DATABASE_URL = TEST_DATABASE_URL;
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('✅ Migrations completed');

    // 4. Generate Prisma client (skip if already generated)
    console.log('🔨 Checking Prisma client...');
    try {
      execSync('npx prisma generate', { 
        stdio: 'inherit',
        cwd: process.cwd()
      });
      console.log('✅ Prisma client generated');
    } catch (error) {
      console.log('⚠️ Prisma client generation skipped (may already be generated)');
    }

    // 5. Clear existing test data
    console.log('🧹 Clearing existing test data...');
    await clearTestData(prisma);
    console.log('✅ Test data cleared');

    // 6. Seed test data
    console.log('🌱 Seeding test data...');
    await seedTestData(prisma);
    console.log('✅ Test data seeded');

    await prisma.$disconnect();
    console.log('🎉 MOVA_TEST database setup completed successfully!');

  } catch (error) {
    console.error('❌ Error setting up test database:', error);
    process.exit(1);
  }
}

async function clearTestData(prisma: PrismaClient) {
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

async function seedTestData(prisma: PrismaClient) {
  // Create test users
  const hashedPassword = await require('bcrypt').hash('password123', 10);

  const adminUser = await prisma.user.create({
    data: {
      name: 'مدیر سیستم',
      email: 'admin@test.com',
      phone: '09123456789',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  const employeeUser = await prisma.user.create({
    data: {
      name: 'احمد محمدی',
      email: 'ahmad@test.com',
      phone: '09123456790',
      password: hashedPassword,
      role: 'EMPLOYEE',
    },
  });

  const customerUser = await prisma.user.create({
    data: {
      name: 'فاطمه احمدی',
      email: 'fateme@test.com',
      phone: '09123456791',
      password: hashedPassword,
      role: 'CUSTOMER',
    },
  });

  // Create employee profile
  const employee = await prisma.employee.create({
    data: {
      userId: employeeUser.id,
      specialty: 'کوتاهی مو',
      baseSalary: 5000000,
      commissionRate: 0.1,
    },
  });

  // Create customer profile
  const customer = await prisma.customer.create({
    data: {
      userId: customerUser.id,
      notes: 'مشتری وفادار',
      birthdate: new Date('1995-03-20'),
    },
  });

  // Create services
  const service1 = await prisma.service.create({
    data: {
      name: 'کوتاهی مو',
      price: 100000,
      durationMinutes: 30,
    },
  });

  const service2 = await prisma.service.create({
    data: {
      name: 'رنگ مو',
      price: 300000,
      durationMinutes: 90,
    },
  });

  const service3 = await prisma.service.create({
    data: {
      name: 'ماسک صورت',
      price: 80000,
      durationMinutes: 45,
    },
  });

  // Assign service to employee
  await prisma.employeeService.create({
    data: {
      employeeId: employee.id,
      serviceId: service1.id,
    },
  });

  // Create appointments
  const appointment1 = await prisma.appointment.create({
    data: {
      customerId: customer.id,
      employeeId: employee.id,
      serviceId: service1.id,
      scheduledAt: new Date('2025-01-10T10:00:00Z'),
      durationMin: 30,
      services: [{ serviceId: service1.id, priceAtBooking: 100000, durationMin: 30, serviceName: 'کوتاهی مو' }],
      status: 'COMPLETED',
    },
  });

  const appointment2 = await prisma.appointment.create({
    data: {
      customerId: customer.id,
      employeeId: employee.id,
      serviceId: service2.id,
      scheduledAt: new Date('2025-01-11T14:00:00Z'),
      durationMin: 90,
      services: [{ serviceId: service2.id, priceAtBooking: 300000, durationMin: 90, serviceName: 'رنگ مو' }],
      status: 'PENDING',
    },
  });

  // Create appointment services
  await prisma.appointmentService.create({
    data: {
      appointmentId: appointment1.id,
      serviceId: service1.id,
      price: service1.price,
    },
  });

  await prisma.appointmentService.create({
    data: {
      appointmentId: appointment2.id,
      serviceId: service2.id,
      price: service2.price,
    },
  });

  // Create transactions
  await prisma.transaction.create({
    data: {
      amount: BigInt(100000),
      type: 'SERVICE',
      paymentMethod: 'CASH',
      relatedId: appointment1.id,
    },
  });

  await prisma.transaction.create({
    data: {
      amount: BigInt(300000),
      type: 'SERVICE',
      paymentMethod: 'CARD',
      relatedId: appointment2.id,
    },
  });

  await prisma.transaction.create({
    data: {
      amount: BigInt(50000),
      type: 'EXPENSE',
      paymentMethod: 'CASH',
    },
  });

  // Create categories
  await prisma.category.create({
    data: {
      name: 'کوتاهی',
      type: 'INCOME',
    },
  });

  await prisma.category.create({
    data: {
      name: 'مواد اولیه',
      type: 'EXPENSE',
    },
  });

  // Create tips
  await prisma.tip.create({
    data: {
      appointmentId: appointment1.id,
      employeeId: employee.id,
      amount: 20000,
    },
  });

  // Create salaries
  await prisma.salary.create({
    data: {
      employeeId: employee.id,
      amount: 5000000,
      periodStart: new Date('2024-12-01T00:00:00Z'),
      periodEnd: new Date('2024-12-31T23:59:59Z'),
      status: 'PENDING',
    },
  });

  // Create day closing
  await prisma.dayClosing.create({
    data: {
      date: new Date('2025-01-10T00:00:00Z'),
      totalIncome: 120000,
      totalExpense: 0,
      totalTips: 20000,
      totalSalaries: 0,
      isClosed: true,
      closedAt: new Date('2025-01-10T18:00:00Z'),
      closedBy: adminUser.id,
    },
  });

  // Create SMS settings
  await prisma.smsSettings.create({
    data: {
      apiKey: 'test-sms-api-key',
      lineNumber: '500012345',
      isEnabled: true,
      sendBeforeAppointment: 60,
      sendAfterAppointment: 10,
      defaultMessage: 'Your appointment is coming soon!',
      updatedAt: new Date(),
    },
  });

  // Create SMS template
  await prisma.smsTemplate.create({
    data: {
      name: 'Appointment Reminder',
      content: 'Dear {{customerName}}, your appointment with {{employeeName}} for {{serviceName}} is on {{appointmentDate}} at {{appointmentTime}}.',
      variables: ['customerName', 'employeeName', 'serviceName', 'appointmentDate', 'appointmentTime'],
      isActive: true,
      updatedAt: new Date(),
    },
  });

  // Create SMS logs
  await prisma.smsLog.create({
    data: {
      phoneNumber: customerUser.phone,
      message: 'Your appointment is confirmed.',
      status: 'SENT',
      customerId: customerUser.id, // This should reference the User table, not Customer table
    },
  });

  // Create Homepage Details
  await prisma.homepageDetails.create({
    data: {
      about: 'Welcome to Doocard Salon!',
      contact: 'Contact us at 123-456-7890',
    },
  });

  console.log('✅ Test data seeded successfully!');
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupTestDatabase();
}

export { setupTestDatabase, clearTestData, seedTestData };
