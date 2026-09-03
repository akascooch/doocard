const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const phone = '09370504588';
  
  try {
    console.log(`\n🔍 جستجوی کاربر با شماره: ${phone}\n`);
    
    const user = await prisma.user.findFirst({
      where: { phone },
      include: {
        customer: true,
        employee: true,
      }
    });
    
    if (user) {
      console.log('✅ کاربر پیدا شد!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📌 ID: ${user.id}`);
      console.log(`👤 نام: ${user.name}`);
      console.log(`📱 شماره: ${user.phone}`);
      console.log(`🎭 نقش: ${user.role}`);
      console.log(`📧 ایمیل: ${user.email || 'ندارد'}`);
      console.log(`📅 تاریخ ثبت: ${user.createdAt}`);
      console.log(`🔑 رمز (hash): ${user.password ? 'موجود است' : 'ندارد'}`);
      
      if (user.customer) {
        console.log('\n👥 اطلاعات مشتری:');
        console.log(`   - تاریخ تولد: ${user.customer.birthdate || 'ثبت نشده'}`);
        console.log(`   - یادداشت: ${user.customer.notes || 'ندارد'}`);
      }
      
      if (user.employee) {
        console.log('\n💼 اطلاعات کارمند:');
        console.log(`   - تخصص‌ها: ${user.employee.specializations || 'ندارد'}`);
        console.log(`   - حقوق: ${user.employee.salary || '0'} تومان`);
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
    } else {
      console.log('❌ کاربری با این شماره پیدا نشد!\n');
      
      // جستجوی users مشابه
      const similarUsers = await prisma.user.findMany({
        where: {
          phone: {
            contains: '0937'
          }
        },
        take: 5,
        select: {
          id: true,
          name: true,
          phone: true,
          role: true,
        }
      });
      
      if (similarUsers.length > 0) {
        console.log('📋 کاربران با شماره مشابه:');
        similarUsers.forEach(u => {
          console.log(`   - ${u.name} (${u.phone}) - ${u.role}`);
        });
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('❌ خطا:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();

