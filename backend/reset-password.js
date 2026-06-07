const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const phone = '09370504588';
  const newPassword = '123456';
  
  try {
    console.log(`\n🔐 تغییر رمز عبور برای: ${phone}\n`);
    
    // Hash کردن رمز جدید
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // به‌روزرسانی رمز
    const updated = await prisma.user.update({
      where: { phone },
      data: { password: hashedPassword }
    });
    
    console.log('✅ رمز عبور با موفقیت تغییر کرد!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📱 شماره: ${phone}`);
    console.log(`🔑 رمز جدید: ${newPassword}`);
    console.log(`👤 کاربر: ${updated.name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('💡 حالا می‌توانی با این اطلاعات لاگین کنی:\n');
    console.log(`   شماره: ${phone}`);
    console.log(`   رمز: ${newPassword}\n`);
    
  } catch (error) {
    console.error('❌ خطا:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

