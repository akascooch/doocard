import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestWithdrawal() {
  try {
    console.log('🔍 Creating test withdrawal request...');
    
    // Get a barber
    const barber = await prisma.barber.findFirst({
      where: { isActive: true },
    });
    
    if (!barber) {
      console.log('❌ No active barber found');
      return;
    }
    
    console.log('📊 Selected barber:', {
      id: barber.id,
      name: `${barber.firstName} ${barber.lastName}`,
      email: barber.email,
    });
    
    // Create withdrawal request
    const withdrawal = await prisma.barberWithdrawalRequest.create({
      data: {
        barberId: barber.id,
        amount: 2000000, // 2 million tomans
        description: 'تست درخواست برداشت',
        status: 'PENDING',
      },
      include: { barber: true },
    });
    
    console.log('✅ Created withdrawal request:', {
      id: withdrawal.id,
      barberName: `${withdrawal.barber.firstName} ${withdrawal.barber.lastName}`,
      amount: withdrawal.amount,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
    });
    
    // Check all withdrawal requests
    const allWithdrawals = await prisma.barberWithdrawalRequest.findMany({
      include: { barber: true },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log('📊 All withdrawal requests:', allWithdrawals.map(w => ({
      id: w.id,
      barberName: `${w.barber.firstName} ${w.barber.lastName}`,
      amount: w.amount,
      status: w.status,
      createdAt: w.createdAt,
    })));
    
  } catch (error) {
    console.error('❌ Error creating test withdrawal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestWithdrawal(); 