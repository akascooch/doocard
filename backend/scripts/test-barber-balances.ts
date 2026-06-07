import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testBarberBalances() {
  try {
    console.log('🔍 Testing barber balances and withdrawals...');
    
    // Test 1: Get all barbers
    const barbers = await prisma.barber.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });
    console.log('📊 All barbers:', barbers);
    
    // Test 2: Get withdrawal requests
    const withdrawals = await prisma.barberWithdrawalRequest.findMany({
      include: { barber: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log('📊 Withdrawal requests:', withdrawals.map(w => ({
      id: w.id,
      barberName: `${w.barber.firstName} ${w.barber.lastName}`,
      amount: w.amount,
      status: w.status,
      createdAt: w.createdAt,
    })));
    
    // Test 3: Get financial entries for each barber
    for (const barber of barbers) {
      console.log(`\n🔍 Testing barber: ${barber.firstName} ${barber.lastName}`);
      
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
      
      // Get withdrawals
      const totalWithdrawals = await prisma.financialEntry.aggregate({
        _sum: { amount: true },
        where: {
          type: 'EXPENSE',
          reference: {
            startsWith: 'WITHDRAWAL-',
          },
          description: {
            contains: `${barber.firstName} ${barber.lastName}`,
          },
        },
      });
      
      console.log('📊 Financial data:', {
        barberId: barber.id,
        totalIncome: totalIncome._sum.amount || 0,
        totalWithdrawals: totalWithdrawals._sum.amount || 0,
        balance: (totalIncome._sum.amount || 0) - (totalWithdrawals._sum.amount || 0),
      });
      
      // Get sample transactions
      const sampleTransactions = await prisma.financialEntry.findMany({
        where: {
          transactions: {
            some: {
              appointment: {
                barberId: barber.id,
              },
            },
          },
        },
        take: 3,
        include: {
          transactions: {
            include: {
              appointment: true,
            },
          },
        },
        orderBy: {
          date: 'desc',
        },
      });
      
      console.log('📊 Sample transactions:', sampleTransactions.map(t => ({
        id: t.id,
        amount: t.amount,
        type: t.type,
        description: t.description,
        date: t.date,
      })));
    }
    
  } catch (error) {
    console.error('❌ Error testing barber balances:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBarberBalances(); 