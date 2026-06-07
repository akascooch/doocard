import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBalanceCalculation() {
  try {
    console.log('🔍 Testing balance calculation...');
    
    const barbers = await prisma.barber.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
    
    for (const barber of barbers) {
      console.log(`\n🔍 Checking balance for: ${barber.firstName} ${barber.lastName}`);
      
      // Get income from appointments
      const totalIncome = await prisma.financialEntry.aggregate({
        _sum: { amount: true },
        where: {
          type: 'INCOME',
          transactions: {
            some: {
              appointment: {
                barberId: barber.id,
              },
            },
          },
        },
      });
      
      // Get withdrawals with both old and new description formats
      const totalWithdrawals = await prisma.financialEntry.aggregate({
        _sum: { amount: true },
        where: {
          type: 'EXPENSE',
          OR: [
            {
              reference: {
                startsWith: 'WITHDRAWAL-',
              },
              description: {
                contains: `${barber.firstName} ${barber.lastName}`,
              },
            },
            {
              description: {
                contains: `پرداخت حقوق به ${barber.firstName} ${barber.lastName}`,
              },
            },
            {
              description: {
                contains: `پرداخت حقوق به آرایشگر ${barber.firstName} ${barber.lastName}`,
              },
            },
          ],
        },
      });
      
      console.log('📊 Balance calculation:', {
        barberId: barber.id,
        totalIncome: totalIncome._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        balance: (totalIncome._sum.amount || 0) - (totalWithdrawals._sum.amount || 0),
      });
      
      // Get sample withdrawal entries
      const withdrawalEntries = await prisma.financialEntry.findMany({
        where: {
          type: 'EXPENSE',
          OR: [
            {
              reference: {
                startsWith: 'WITHDRAWAL-',
              },
              description: {
                contains: `${barber.firstName} ${barber.lastName}`,
              },
            },
            {
              description: {
                contains: `پرداخت حقوق به ${barber.firstName} ${barber.lastName}`,
              },
            },
            {
              description: {
                contains: `پرداخت حقوق به آرایشگر ${barber.firstName} ${barber.lastName}`,
              },
            },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      
      console.log('📊 Sample withdrawal entries:', withdrawalEntries.map(e => ({
        id: e.id,
        amount: e.amount,
        description: e.description,
        reference: e.reference,
        createdAt: e.createdAt,
      })));
    }
    
  } catch (error) {
    console.error('❌ Error testing balance calculation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBalanceCalculation(); 