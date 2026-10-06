import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function fullReset() {
  console.log('🔄 شروع ریست کامل سیستم...');
  console.log('');
  
  try {
    // 1. پاک کردن تمام داده‌ها
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
    console.log('');
    
    // 2. ایجاد کاربر ادمین
    console.log('👤 ایجاد کاربر ادمین...');
    
    const password = process.env.FULL_RESET_ADMIN_PASSWORD;
    if (!password) throw new Error('FULL_RESET_ADMIN_PASSWORD is required');
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'مدیر',
        lastName: 'سیستم',
        phoneNumber: '09120000000',
        role: 'ADMIN',
        updatedAt: new Date(),
      },
    });

    console.log('✅ کاربر ادمین ایجاد شد');
    console.log(`📧 ایمیل: ${admin.email}`);
    console.log('Admin password was taken from the environment and was not printed.');
    console.log('');
    
    // 3. ایجاد تنظیمات اولیه SMS
    console.log('📱 ایجاد تنظیمات اولیه SMS...');
    
    await prisma.smsSettings.create({
      data: {
        apiKey: '',
        lineNumber: '',
        isEnabled: false,
        sendBeforeAppointment: 60,
        sendAfterAppointment: 0,
        defaultMessage: '',
        updatedAt: new Date(),
      },
    });

    console.log('✅ تنظیمات SMS ایجاد شد');
    console.log('');
    
    // 4. ایجاد دسته‌بندی‌های مالی اولیه
    console.log('💰 ایجاد دسته‌بندی‌های مالی اولیه...');
    
    await prisma.financialCategory.createMany({
      data: [
        {
          name: 'درآمد خدمات',
          type: 'INCOME',
          description: 'درآمد حاصل از ارائه خدمات آرایشگری',
          updatedAt: new Date(),
        },
        {
          name: 'فروش محصولات',
          type: 'INCOME',
          description: 'درآمد حاصل از فروش محصولات آرایشی',
          updatedAt: new Date(),
        },
        {
          name: 'حقوق و دستمزد',
          type: 'EXPENSE',
          description: 'پرداخت حقوق به کارکنان',
          updatedAt: new Date(),
        },
        {
          name: 'اجاره',
          type: 'EXPENSE',
          description: 'هزینه اجاره ماهانه',
          updatedAt: new Date(),
        },
        {
          name: 'قبوض',
          type: 'EXPENSE',
          description: 'هزینه آب، برق، گاز و تلفن',
          updatedAt: new Date(),
        },
        {
          name: 'خرید لوازم مصرفی',
          type: 'EXPENSE',
          description: 'خرید مواد و لوازم مصرفی آرایشگاه',
          updatedAt: new Date(),
        },
      ],
    });

    console.log('✅ دسته‌بندی‌های مالی ایجاد شدند');
    console.log('');
    
    console.log('🎉 ریست کامل با موفقیت انجام شد!');
    console.log('');
    console.log('📋 خلاصه:');
    console.log('   ✅ تمام داده‌ها پاک شدند');
    console.log('   ✅ کاربر ادمین ایجاد شد');
    console.log('   ✅ تنظیمات SMS ایجاد شد');
    console.log('   ✅ دسته‌بندی‌های مالی ایجاد شدند');
    console.log('');
    console.log('💡 حالا می‌توانید وارد سیستم شوید:');
    console.log(`   📧 ایمیل: ${admin.email}`);
    console.log('Admin password was taken from the environment and was not printed.');
    console.log('');
    console.log('🚀 برای اجرای سرور:');
    console.log('   npm run start:dev');
    
  } catch (error) {
    console.error('❌ خطا در ریست کامل:', error);
    throw error;
  }
}

fullReset()
  .catch((e) => {
    console.error('خطا:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 