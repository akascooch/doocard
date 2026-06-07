const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testMonthlyRevenue() {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  console.log('\n📅 تست محاسبه درآمد ماهانه');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`از: ${startOfMonth.toLocaleDateString('fa-IR')}`);
  console.log(`تا: ${endOfMonth.toLocaleDateString('fa-IR')}\n`);

  // محاسبه درآمد از نوبت‌ها
  const appointmentsRevenue = await prisma.appointment.aggregate({
    _sum: { amount: true },
    where: {
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      deletedAt: null,
      amount: { not: null },
    },
  });

  console.log('💎 درآمد از نوبت‌ها:');
  console.log(`  ${Number(appointmentsRevenue._sum.amount || 0)/10} تومان`);

  // درآمدهای دیگر
  const otherIncome = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      type: 'INCOME',
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  console.log('\n💰 درآمدهای دیگر (INCOME):');
  console.log(`  ${Number(otherIncome._sum.amount || 0)/10} تومان`);

  // هزینه‌ها
  const expenses = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: {
      type: 'EXPENSE',
      createdAt: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });

  console.log('\n📤 هزینه‌ها (EXPENSE):');
  console.log(`  ${Number(expenses._sum.amount || 0)/10} تومان`);

  // محاسبه سود خالص
  const totalRevenue = Number(appointmentsRevenue._sum.amount || 0) + Number(otherIncome._sum.amount || 0);
  const totalExpenses = Number(expenses._sum.amount || 0);
  const netProfit = totalRevenue - totalExpenses;

  console.log('\n📊 نتیجه نهایی:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  کل درآمد: ${(totalRevenue/10).toLocaleString('fa-IR')} تومان`);
  console.log(`  کل هزینه: ${(totalExpenses/10).toLocaleString('fa-IR')} تومان`);
  console.log(`  سود خالص: ${(netProfit/10).toLocaleString('fa-IR')} تومان`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('✅ این عدد باید در "درآمد ماهانه" نمایش داده شود!\n');

  await prisma.$disconnect();
}

testMonthlyRevenue();

