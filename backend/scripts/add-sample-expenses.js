const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addSampleExpenses() {
  console.log('💰 اضافه کردن داده‌های نمونه هزینه...\n');

  try {
    // دریافت حساب‌های بانکی موجود
    const bankAccounts = await prisma.bankAccount.findMany();
    if (bankAccounts.length === 0) {
      console.log('❌ هیچ حساب بانکی یافت نشد! ابتدا حساب بانکی اضافه کنید.');
      return;
    }

    // دریافت یک نوبت موجود برای appointmentId
    const existingAppointment = await prisma.appointment.findFirst();
    if (!existingAppointment) {
      console.log('❌ هیچ نوبتی یافت نشد! ابتدا نوبتی ایجاد کنید.');
      return;
    }

    // انواع هزینه‌های نمونه
    const expenseTypes = [
      { name: 'اجاره ماهانه', amount: -5000000, category: 'RENT' },
      { name: 'قبوض آب و برق', amount: -800000, category: 'UTILITY' },
      { name: 'مواد مصرفی', amount: -1200000, category: 'SUPPLIES' },
      { name: 'حقوق کارکنان', amount: -3000000, category: 'SALARY' },
      { name: 'تعمیرات', amount: -1500000, category: 'OTHER' },
      { name: 'بیمه', amount: -600000, category: 'OTHER' },
      { name: 'تبلیغات', amount: -400000, category: 'OTHER' },
      { name: 'حمل و نقل', amount: -300000, category: 'OTHER' },
    ];

    const createdExpenses = [];

    // اضافه کردن هزینه‌های نمونه برای 3 ماه گذشته
    for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() - monthOffset);
      
      // برای هر ماه، 3-5 هزینه تصادفی اضافه کن
      const numExpenses = Math.floor(Math.random() * 3) + 3; // 3 تا 5 هزینه
      
      for (let i = 0; i < numExpenses; i++) {
        const expenseType = expenseTypes[Math.floor(Math.random() * expenseTypes.length)];
        const randomBankAccount = bankAccounts[Math.floor(Math.random() * bankAccounts.length)];
        
        // تغییر مبلغ به صورت تصادفی (±20%)
        const variation = 0.8 + (Math.random() * 0.4); // 0.8 تا 1.2
        const amount = Math.round(expenseType.amount * variation);
        
        const expense = await prisma.transaction.create({
          data: {
            amount: amount,
            paymentMethod: 'CASH',
            createdAt: targetDate,
            updatedAt: targetDate,
            appointmentId: existingAppointment.id,
            status: 'COMPLETED',
            category: expenseType.category,
            type: 'NORMAL',
            bankAccountId: randomBankAccount.id,
            description: `${expenseType.name} - ${targetDate.toLocaleDateString('fa-IR')}`,
          },
        });
        
        createdExpenses.push(expense);
        console.log(`✅ هزینه اضافه شد: ${expenseType.name} - ${Math.abs(amount).toLocaleString()} تومان`);
      }
    }

    console.log(`\n🎉 ${createdExpenses.length} هزینه نمونه اضافه شد!`);
    
    // نمایش آمار جدید
    const totalExpenses = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true },
    });
    
    console.log(`💰 مجموع هزینه‌ها: ${Math.abs(totalExpenses._sum.amount || 0).toLocaleString()} تومان`);

  } catch (error) {
    console.error('❌ خطا در اضافه کردن هزینه‌ها:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addSampleExpenses(); 