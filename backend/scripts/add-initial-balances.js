const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addInitialBalances() {
  console.log('🏦 اضافه کردن موجودی اولیه به حساب‌های بانکی...\n');

  try {
    // دریافت حساب‌های بانکی موجود
    const bankAccounts = await prisma.bankAccount.findMany();
    if (bankAccounts.length === 0) {
      console.log('❌ هیچ حساب بانکی یافت نشد!');
      return;
    }

    // دریافت یک نوبت موجود برای appointmentId
    const existingAppointment = await prisma.appointment.findFirst();
    if (!existingAppointment) {
      console.log('❌ هیچ نوبتی یافت نشد!');
      return;
    }

    const createdBalances = [];

    for (const account of bankAccounts) {
      // موجودی اولیه تصادفی بین 50M تا 200M
      const initialBalance = Math.floor(Math.random() * 150000000) + 50000000;
      
      const balanceTransaction = await prisma.transaction.create({
        data: {
          amount: initialBalance,
          paymentMethod: 'CASH',
          createdAt: new Date('2024-01-01'), // تاریخ اول سال
          updatedAt: new Date('2024-01-01'),
          appointmentId: existingAppointment.id,
          status: 'COMPLETED',
          category: 'OTHER',
          type: 'NORMAL',
          bankAccountId: account.id,
          description: `موجودی اولیه حساب ${account.name}`,
        },
      });
      
      createdBalances.push(balanceTransaction);
      console.log(`✅ موجودی اولیه اضافه شد: ${account.name} - ${initialBalance.toLocaleString()} تومان`);
    }

    console.log(`\n🎉 ${createdBalances.length} موجودی اولیه اضافه شد!`);
    
    // نمایش آمار جدید
    const totalBalance = await prisma.transaction.aggregate({
      where: { 
        bankAccountId: { not: null },
        amount: { gt: 0 }
      },
      _sum: { amount: true },
    });
    
    const totalExpenses = await prisma.transaction.aggregate({
      where: { 
        bankAccountId: { not: null },
        amount: { lt: 0 }
      },
      _sum: { amount: true },
    });
    
    const netBalance = (totalBalance._sum.amount || 0) + (totalExpenses._sum.amount || 0);
    
    console.log(`💰 موجودی کل حساب‌های بانکی: ${netBalance.toLocaleString()} تومان`);

  } catch (error) {
    console.error('❌ خطا در اضافه کردن موجودی اولیه:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addInitialBalances(); 