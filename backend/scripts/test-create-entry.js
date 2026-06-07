const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCreateEntry() {
  try {
    console.log('🧪 Testing createEntry method...\n');

    // 1. بررسی وضعیت فعلی
    console.log('📊 Current transactions count:');
    const currentTransactions = await prisma.transaction.count();
    console.log(`Total transactions: ${currentTransactions}`);

    // 2. پیدا کردن آخرین ID
    const lastTransaction = await prisma.transaction.findFirst({
      orderBy: { id: 'desc' }
    });
    console.log(`Last transaction ID: ${lastTransaction?.id || 'None'}`);

    // 3. پیدا کردن appointment موجود
    const appointment = await prisma.appointment.findFirst({
      orderBy: { id: 'desc' }
    });
    console.log(`Available appointment ID: ${appointment?.id || 'None'}`);

    // 4. پیدا کردن barber موجود
    const barber = await prisma.barber.findFirst({
      orderBy: { id: 'desc' }
    });
    console.log(`Available barber ID: ${barber?.id || 'None'}`);

    // 5. پیدا کردن bank account موجود
    const bankAccount = await prisma.bankAccount.findFirst({
      orderBy: { id: 'desc' }
    });
    console.log(`Available bank account ID: ${bankAccount?.id || 'None'}`);

    // 6. پیدا کردن financial category موجود
    const categories = await prisma.financialCategory.findMany({
      where: { type: 'EXPENSE' },
      take: 3
    });
    console.log(`Available expense categories: ${categories.map(c => `${c.id}:${c.name}`).join(', ')}`);

    console.log('\n✅ Test completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testCreateEntry();
