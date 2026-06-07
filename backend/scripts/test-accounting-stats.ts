import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAccountingStats() {
  try {
    console.log('🔍 Testing accounting stats...');
    
    // Test getAllStats (for admin)
    const [totalIncome, totalExpense] = await Promise.all([
      prisma.financialEntry.aggregate({
        where: { type: 'INCOME' },
        _sum: { amount: true },
      }),
      prisma.financialEntry.aggregate({
        where: { type: 'EXPENSE' },
        _sum: { amount: true },
      }),
    ]);

    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [monthlyIncome, monthlyExpense] = await Promise.all([
      prisma.financialEntry.aggregate({
        where: {
          type: 'INCOME',
          date: { gte: firstDayOfMonth },
        },
        _sum: { amount: true },
      }),
      prisma.financialEntry.aggregate({
        where: {
          type: 'EXPENSE',
          date: { gte: firstDayOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

    const stats = {
      totalIncome: totalIncome._sum.amount || 0,
      totalTips: 0,
      totalWithdrawn: 0,
      totalSalaries: 0,
      currentBalance: (totalIncome._sum.amount || 0) - (totalExpense._sum.amount || 0),
      salaryPercentage: 100,
      availableIncome: totalIncome._sum.amount || 0,
      salonShare: 0,
      totalExpense: totalExpense._sum.amount || 0,
      balance: (totalIncome._sum.amount || 0) - (totalExpense._sum.amount || 0),
      monthlyIncome: monthlyIncome._sum.amount || 0,
      monthlyExpense: monthlyExpense._sum.amount || 0,
    };
    
    console.log('📊 Stats for admin:', JSON.stringify(stats, null, 2));
    
    // Test getEntries (for admin)
    const entries = await prisma.financialEntry.findMany({
      where: { type: 'INCOME' },
      take: 5,
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
    });
    
    console.log('📊 Sample entries:', entries.map(e => ({
      id: e.id,
      amount: e.amount,
      type: e.type,
      category: e.category?.name,
      description: e.description,
    })));
    
  } catch (error) {
    console.error('❌ Error testing accounting stats:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAccountingStats(); 