const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function simpleTest() {
  try {
    console.log('🧪 Simple test...\n');

    // 1. بررسی تعداد تراکنش‌ها
    const count = await prisma.transaction.count();
    console.log(`Current transactions count: ${count}`);

    // 2. نمایش آخرین تراکنش
    const lastTransaction = await prisma.transaction.findFirst({
      orderBy: { id: 'desc' }
    });

    if (lastTransaction) {
      console.log(`Last transaction ID: ${lastTransaction.id}`);
      console.log(`Last transaction amount: ${lastTransaction.amount}`);
      console.log(`Last transaction category: ${lastTransaction.category}`);
    }

    // 3. بررسی appointment موجود
    const appointment = await prisma.appointment.findFirst({
      orderBy: { id: 'desc' }
    });

    if (appointment) {
      console.log(`Available appointment ID: ${appointment.id}`);
    }

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
  } finally {
    await prisma.$disconnect();
  }
}

simpleTest();
