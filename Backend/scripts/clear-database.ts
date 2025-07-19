import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('🧹 شروع پاک کردن دیتابیس...');
  
  try {
    // پاک کردن تمام جداول به ترتیب صحیح (با در نظر گرفتن foreign keys)
    console.log('🗑️ پاک کردن تراکنش‌ها...');
    await prisma.transaction.deleteMany();
    
    console.log('🗑️ پاک کردن نوبت‌ها...');
    await prisma.appointment.deleteMany();
    
    console.log('🗑️ پاک کردن ورودی‌های مالی...');
    await prisma.financialEntry.deleteMany();
    
    console.log('🗑️ پاک کردن دسته‌بندی‌های مالی...');
    await prisma.financialCategory.deleteMany();
    
    console.log('🗑️ پاک کردن حقوق‌ها...');
    await prisma.salary.deleteMany();
    
    console.log('🗑️ پاک کردن خدمات...');
    await prisma.service.deleteMany();
    
    console.log('🗑️ پاک کردن مشتریان...');
    await prisma.customer.deleteMany();
    
    console.log('🗑️ پاک کردن آرایشگران...');
    await prisma.barber.deleteMany();
    
    console.log('🗑️ پاک کردن پروفایل‌ها...');
    await prisma.profile.deleteMany();
    
    console.log('🗑️ پاک کردن لاگ‌های پیامک...');
    await prisma.smsLog.deleteMany();
    
    console.log('🗑️ پاک کردن قالب‌های پیامک...');
    await prisma.smsTemplate.deleteMany();
    
    console.log('🗑️ پاک کردن تنظیمات پیامک...');
    await prisma.smsSettings.deleteMany();
    
    console.log('🗑️ پاک کردن کاربران...');
    await prisma.user.deleteMany();
    
    console.log('✅ دیتابیس با موفقیت پاک شد!');
    console.log('📝 حالا می‌توانید داده‌های خود را اضافه کنید.');
    
  } catch (error) {
    console.error('❌ خطا در پاک کردن دیتابیس:', error);
    throw error;
  }
}

clearDatabase()
  .catch((e) => {
    console.error('خطا:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 