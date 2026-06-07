const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
  try {
    console.log('🔍 بررسی کاربران موجود در دیتابیس...');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      }
    });
    
    if (users.length === 0) {
      console.log('❌ هیچ کاربری در دیتابیس وجود ندارد');
    } else {
      console.log(`✅ ${users.length} کاربر در دیتابیس یافت شد:`);
      users.forEach((user, index) => {
        console.log(`${index + 1}. ID: ${user.id}, Email: ${user.email}, Name: ${user.firstName} ${user.lastName}, Role: ${user.role}`);
      });
    }
    
  } catch (error) {
    console.error('❌ خطا در بررسی کاربران:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers(); 