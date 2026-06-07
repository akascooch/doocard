const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function updateAdminPassword() {
  try {
    console.log('🔄 شروع به‌روزرسانی پسورد ادمین...');
    
    // Hash password '123456'
    const hashedPassword = await bcrypt.hash('123456', 10);
    console.log('✅ پسورد hash شد');
    
    // Update admin user password (scoochexy@gmail.com)
    const updatedUser = await prisma.user.update({
      where: {
        email: 'scoochexy@gmail.com'
      },
      data: {
        password: hashedPassword
      }
    });
    
    console.log('✅ پسورد ادمین به‌روزرسانی شد');
    console.log('👤 کاربر:', updatedUser.email);
    console.log('🔑 پسورد جدید: 123456');
    
  } catch (error) {
    console.error('❌ خطا در به‌روزرسانی پسورد:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdminPassword();
