const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testNewTransaction() {
  try {
    console.log('🧪 Testing new transaction creation...\n');

    // 1. بررسی وضعیت فعلی
    console.log('📊 Current transactions count:');
    const currentTransactions = await prisma.transaction.count();
    console.log(`Total transactions: ${currentTransactions}`);

    // 2. ایجاد یک تراکنش هزینه جدید
    console.log('\n💰 Creating new expense transaction...');
    
    // ابتدا یک appointment موجود پیدا کنیم
    const existingAppointment = await prisma.appointment.findFirst({
      orderBy: { id: 'desc' }
    });
    
    if (!existingAppointment) {
      console.log('❌ No appointments found!');
      return;
    }

    console.log(`Using appointment ID: ${existingAppointment.id}`);

    // ابتدا بزرگترین ID موجود را پیدا کنیم
    const maxId = await prisma.transaction.aggregate({
      _max: { id: true }
    });
    const nextId = (maxId._max.id || 0) + 1;

    // ایجاد تراکنش هزینه
    const newTransaction = await prisma.transaction.create({
      data: {
        id: nextId,
        amount: -500000, // 500 هزار تومان هزینه
        category: 'OTHER',
        description: 'تست تراکنش هزینه جدید',
        status: 'COMPLETED',
        type: 'NORMAL',
        transactionType: 'FINANCIAL_ENTRY',
        appointmentId: existingAppointment.id,
        barberId: 1, // یا ID آرایشگر موجود
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    console.log('✅ New transaction created:', newTransaction);

    // 3. بررسی وضعیت جدید
    console.log('\n📊 Updated transactions count:');
    const newTransactionsCount = await prisma.transaction.count();
    console.log(`Total transactions: ${newTransactionsCount}`);

    // 4. نمایش آخرین تراکنش‌ها
    console.log('\n📋 Recent transactions:');
    const recentTransactions = await prisma.transaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amount: true,
        category: true,
        description: true,
        createdAt: true,
        status: true
      }
    });

    recentTransactions.forEach((t, i) => {
      const sign = t.amount >= 0 ? '+' : '';
      console.log(`${i + 1}. ${t.category}: ${sign}${t.amount.toLocaleString('fa-IR')} - ${t.description || 'بدون توضیح'}`);
    });

    // 5. محاسبه آمار جدید
    console.log('\n💰 Updated stats:');
    const totalIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true }
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true }
    });

    console.log(`Total Income: ${(totalIncome._sum.amount || 0).toLocaleString('fa-IR')}`);
    console.log(`Total Expense: ${Math.abs(totalExpense._sum.amount || 0).toLocaleString('fa-IR')}`);
    console.log(`Balance: ${((totalIncome._sum.amount || 0) + (totalExpense._sum.amount || 0)).toLocaleString('fa-IR')}`);

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewTransaction();
