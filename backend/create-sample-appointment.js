const { PrismaClient } = require('@prisma/client');
const jalaali = require('jalaali-js');

const prisma = new PrismaClient();

async function createSampleAppointment() {
  console.log('\n📝 ساخت نوبت نمونه برای تست فیلتر\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // دریافت اولین customer و employee
    const customer = await prisma.customer.findFirst();
    const employee = await prisma.employee.findFirst();
    const service = await prisma.service.findFirst();

    if (!customer || !employee || !service) {
      console.log('⚠️ ابتدا باید customer، employee و service داشته باشی!\n');
      return;
    }

    console.log(`✅ Customer: ${customer.name} (ID: ${customer.id})`);
    console.log(`✅ Employee: ${employee.name} (ID: ${employee.id})`);
    console.log(`✅ Service: ${service.name} (ID: ${service.id})\n`);

    // تاریخ امروز
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0); // امروز ساعت 10:00
    
    // تبدیل به جلالی برای نمایش
    const { jy, jm, jd } = jalaali.toJalaali(
      today.getFullYear(),
      today.getMonth() + 1,
      today.getDate()
    );
    const jalaliToday = `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;

    console.log(`📅 تاریخ امروز:`);
    console.log(`   میلادی: ${today.toISOString().split('T')[0]}`);
    console.log(`   جلالی: ${jalaliToday}\n`);

    // ساخت نوبت
    const appointment = await prisma.appointment.create({
      data: {
        scheduledAt: today,
        customerId: customer.id,
        employeeId: employee.id,
        status: 'SETTLED',
        amount: BigInt(25000000), // 2.5 میلیون تومان
        durationMin: 30,
        services: {
          connect: [{ id: service.id }],
        },
      },
    });

    console.log('✅ نوبت نمونه ساخته شد!\n');
    console.log(`   ID: ${appointment.id}`);
    console.log(`   تاریخ: ${jalaliToday}`);
    console.log(`   مبلغ: 2,500,000 تومان`);
    console.log(`   وضعیت: SETTLED\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔍 حالا تست کن:');
    console.log('   1. برو به صفحه appointments');
    console.log('   2. فیلتر "امروز" رو انتخاب کن');
    console.log('   3. باید این نوبت رو ببینی!\n');

  } catch (error) {
    console.error('❌ خطا:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleAppointment();

