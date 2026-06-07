import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🔄 شروع ریست کامل دیتابیس...');
  
  try {
    // پاک کردن تمام داده‌ها
    console.log('🗑️ پاک کردن تمام داده‌ها...');
    
    await prisma.transaction.deleteMany();
    await prisma.appointment.deleteMany();
    await prisma.financialEntry.deleteMany();
    await prisma.financialCategory.deleteMany();
    await prisma.salary.deleteMany();
    await prisma.service.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.barber.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.smsLog.deleteMany();
    await prisma.smsTemplate.deleteMany();
    await prisma.smsSettings.deleteMany();
    await prisma.user.deleteMany();
    
    console.log('✅ تمام داده‌ها پاک شدند');
    console.log('📝 حالا می‌توانید داده‌های خود را اضافه کنید.');
    console.log('');
    console.log('💡 برای ریست کامل migration ها، دستور زیر را اجرا کنید:');
    console.log('   npm run prisma:migrate');
    console.log('');
    console.log('💡 برای تولید Prisma Client:');
    console.log('   npm run prisma:generate');
    
  } catch (error) {
    console.error('❌ خطا در ریست کردن دیتابیس:', error);
    throw error;
  }
}

resetDatabase()
  .catch((e) => {
    console.error('خطا:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 