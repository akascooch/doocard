import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  console.log('👤 ایجاد کاربر ادمین...');
  
  try {
    // بررسی وجود کاربر ادمین
    const existingAdmin = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (existingAdmin) {
      console.log('⚠️ کاربر ادمین قبلاً وجود دارد');
      console.log(`📧 ایمیل: ${existingAdmin.email}`);
      return;
    }

    // ایجاد رمز عبور
    const password = '123456';
    const hashedPassword = await bcrypt.hash(password, 10);

    // ایجاد کاربر ادمین
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

    console.log('✅ کاربر ادمین با موفقیت ایجاد شد');
    console.log(`📧 ایمیل: ${admin.email}`);
    console.log(`🔑 رمز عبور: ${password}`);
    console.log('');
    console.log('💡 می‌توانید با این اطلاعات وارد سیستم شوید');
    
  } catch (error) {
    console.error('❌ خطا در ایجاد کاربر ادمین:', error);
    throw error;
  }
}

createAdmin()
  .catch((e) => {
    console.error('خطا:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 