import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testWithdrawalApproval() {
  try {
    console.log('🔍 Testing withdrawal approval...');
    
    // Test 1: Get recent withdrawal requests
    const withdrawals = await prisma.barberWithdrawalRequest.findMany({
      include: { barber: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    console.log('📊 Recent withdrawal requests:', withdrawals.map(w => ({
      id: w.id,
      barberName: `${w.barber.firstName} ${w.barber.lastName}`,
      amount: w.amount,
      status: w.status,
      createdAt: w.createdAt,
    })));
    
    // Test 2: Get recent financial entries
    const entries = await prisma.financialEntry.findMany({
      include: { category: true, bankAccount: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log('📊 Recent financial entries:', entries.map(e => ({
      id: e.id,
      amount: e.amount,
      type: e.type,
      description: e.description,
      reference: e.reference,
      category: e.category?.name,
      bankAccount: e.bankAccount?.name,
      createdAt: e.createdAt,
    })));
    
    // Test 3: Check for withdrawal-related entries
    const withdrawalEntries = await prisma.financialEntry.findMany({
      where: {
        OR: [
          { reference: { startsWith: 'WITHDRAWAL-' } },
          { description: { contains: 'پرداخت حقوق به آرایشگر' } },
          { description: { contains: 'سهم آرایشگاه از برداشت' } },
        ],
      },
      include: { category: true, bankAccount: true },
      orderBy: { createdAt: 'desc' },
    });
    console.log('📊 Withdrawal-related entries:', withdrawalEntries.map(e => ({
      id: e.id,
      amount: e.amount,
      type: e.type,
      description: e.description,
      reference: e.reference,
      category: e.category?.name,
      bankAccount: e.bankAccount?.name,
      createdAt: e.createdAt,
    })));
    
    // Test 4: Check barber balances
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
      
      // Get withdrawals
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
    }
    
  } catch (error) {
    console.error('❌ Error testing withdrawal approval:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWithdrawalApproval(); 