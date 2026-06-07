const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createExpense() {
  try {
    console.log('💰 Creating new expense transaction...\n');

    // ایجاد تراکنش هزینه جدید
    const newTransaction = await prisma.transaction.create({
      data: {
        id: 147,
        amount: -750000, // 750 هزار تومان هزینه
        category: 'OTHER',
        description: 'هزینه جدید تست',
        status: 'COMPLETED',
        type: 'NORMAL',
        transactionType: 'FINANCIAL_ENTRY',
        appointmentId: 149,
        barberId: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    });

    console.log('✅ New expense transaction created:');
    console.log(`ID: ${newTransaction.id}`);
    console.log(`Amount: ${newTransaction.amount.toLocaleString('fa-IR')}`);
    console.log(`Category: ${newTransaction.category}`);
    console.log(`Description: ${newTransaction.description}`);

    // بررسی تعداد کل تراکنش‌ها
    const totalCount = await prisma.transaction.count();
    console.log(`\nTotal transactions: ${totalCount}`);

    // بررسی آمار جدید
    const totalIncome = await prisma.transaction.aggregate({
      where: { amount: { gt: 0 } },
      _sum: { amount: true }
    });

    const totalExpense = await prisma.transaction.aggregate({
      where: { amount: { lt: 0 } },
      _sum: { amount: true }
    });

    console.log('\n💰 Updated stats:');
    console.log(`Total Income: ${(totalIncome._sum.amount || 0).toLocaleString('fa-IR')}`);
    console.log(`Total Expense: ${Math.abs(totalExpense._sum.amount || 0).toLocaleString('fa-IR')}`);
    console.log(`Balance: ${((totalIncome._sum.amount || 0) + (totalExpense._sum.amount || 0)).toLocaleString('fa-IR')}`);

    console.log('\n✅ Expense transaction created successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'P2002') {
      console.error('Duplicate ID error - trying with next available ID...');
      
      // پیدا کردن ID بعدی
      const maxId = await prisma.transaction.aggregate({
        _max: { id: true }
      });
      const nextId = (maxId._max.id || 0) + 1;
      console.log(`Next available ID: ${nextId}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createExpense();
