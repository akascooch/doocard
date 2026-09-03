const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  console.log('\n📅 بررسی داده‌های ماه جاری');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`از: ${startOfMonth.toLocaleDateString('fa-IR')}`);
  console.log(`تا: ${endOfMonth.toLocaleDateString('fa-IR')}\n`);

  // 1. Appointments
  const appointments = await prisma.appointment.aggregate({
    _sum: { amount: true, tipAmount: true },
    _count: { id: true },
    where: {
      createdAt: { gte: startOfMonth, lte: endOfMonth },
      deletedAt: null
    }
  });

  console.log('📊 APPOINTMENTS (این ماه):');
  console.log(`  تعداد: ${appointments._count.id}`);
  console.log(`  مجموع amount: ${appointments._sum.amount ? Number(appointments._sum.amount)/10 : 0} تومان (${appointments._sum.amount || 0} ریال)`);
  console.log(`  مجموع tip: ${appointments._sum.tipAmount ? Number(appointments._sum.tipAmount)/10 : 0} تومان (${appointments._sum.tipAmount || 0} ریال)`);

  // Check appointments with NULL amount
  const appointmentsWithAmount = await prisma.appointment.count({
    where: {
      createdAt: { gte: startOfMonth, lte: endOfMonth },
      deletedAt: null,
      amount: { not: null }
    }
  });
  console.log(`  تعداد با مبلغ ثبت شده: ${appointmentsWithAmount} از ${appointments._count.id}`);

  // 2. Transactions (SERVICE)
  const transactions = await prisma.transaction.aggregate({
    _sum: { amount: true },
    _count: { id: true },
    where: {
      type: 'SERVICE',
      createdAt: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  console.log('\n💰 TRANSACTIONS (SERVICE - این ماه):');
  console.log(`  تعداد: ${transactions._count.id}`);
  console.log(`  مجموع: ${transactions._sum.amount ? Number(transactions._sum.amount)/10 : 0} تومان (${transactions._sum.amount || 0} ریال)`);

  // 3. Transactions (EXPENSE)
  const expenses = await prisma.transaction.aggregate({
    _sum: { amount: true },
    _count: { id: true },
    where: {
      type: 'EXPENSE',
      createdAt: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  console.log('\n📤 TRANSACTIONS (EXPENSE - این ماه):');
  console.log(`  تعداد: ${expenses._count.id}`);
  console.log(`  مجموع: ${expenses._sum.amount ? Number(expenses._sum.amount)/10 : 0} تومان (${expenses._sum.amount || 0} ریال)`);

  // 4. Transactions (INCOME)
  const income = await prisma.transaction.aggregate({
    _sum: { amount: true },
    _count: { id: true },
    where: {
      type: 'INCOME',
      createdAt: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  console.log('\n📥 TRANSACTIONS (INCOME - این ماه):');
  console.log(`  تعداد: ${income._count.id}`);
  console.log(`  مجموع: ${income._sum.amount ? Number(income._sum.amount)/10 : 0} تومان (${income._sum.amount || 0} ریال)`);

  // 5. محاسبه درآمد خالص
  const totalRevenue = Number(transactions._sum.amount || 0) + Number(income._sum.amount || 0);
  const totalExpenses = Number(expenses._sum.amount || 0);
  const netProfit = totalRevenue - totalExpenses;

  console.log('\n📈 خلاصه مالی:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  کل درآمد: ${(totalRevenue/10).toLocaleString('fa-IR')} تومان`);
  console.log(`  کل هزینه: ${(totalExpenses/10).toLocaleString('fa-IR')} تومان`);
  console.log(`  سود خالص: ${(netProfit/10).toLocaleString('fa-IR')} تومان`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  await prisma.$disconnect();
}

main();

