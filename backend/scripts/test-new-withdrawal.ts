import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNewWithdrawal() {
  try {
    console.log('🔍 Testing new withdrawal approval...');
    
    // Create a test withdrawal request
    const testWithdrawal = await prisma.barberWithdrawalRequest.create({
      data: {
        barberId: 30, // آرایشگر موقر
        amount: 1000000,
        description: 'تست برداشت',
        status: 'PENDING',
      },
      include: { barber: true },
    });
    
    console.log('📊 Created test withdrawal:', {
      id: testWithdrawal.id,
      barberName: `${testWithdrawal.barber.firstName} ${testWithdrawal.barber.lastName}`,
      amount: testWithdrawal.amount,
      status: testWithdrawal.status,
    });
    
    // Simulate approval
    const withdrawal = await prisma.barberWithdrawalRequest.update({
      where: { id: testWithdrawal.id },
      data: { status: 'APPROVED', approvedBy: 20, updatedAt: new Date() },
      include: { barber: true },
    });
    
    console.log('📊 Updated withdrawal:', withdrawal);
    
    // Calculate shares
    const salonPercentage = 40;
    const salonShare = Math.round(withdrawal.amount * salonPercentage / 100);
    const barberShare = withdrawal.amount - salonShare;
    
    console.log('📊 Calculated shares:', {
      totalAmount: withdrawal.amount,
      salonPercentage,
      salonShare,
      barberShare,
    });
    
    // Get or create salary category
    const salaryCategory = await prisma.financialCategory.findFirst({
      where: { name: 'حقوق و دستمزد', type: 'EXPENSE' }
    }) || await prisma.financialCategory.create({
      data: {
        name: 'حقوق و دستمزد',
        type: 'EXPENSE',
        description: 'پرداخت حقوق و دستمزد به کارکنان',
        updatedAt: new Date()
      }
    });
    
    console.log('📊 Salary category:', salaryCategory);
    
    // Create barber share entry
    const barberEntry = await prisma.financialEntry.create({
      data: {
        amount: -barberShare,
        type: 'EXPENSE',
        date: new Date(),
        description: `پرداخت حقوق به ${withdrawal.barber.firstName} ${withdrawal.barber.lastName} (سهم آرایشگر: ${barberShare.toLocaleString()} تومان)`,
        categoryId: salaryCategory.id,
        reference: `WITHDRAWAL-${withdrawal.id}`,
        paymentMethod: 'CASH',
        createdBy: 20,
        updatedAt: new Date(),
      },
      include: { category: true },
    });
    
    console.log('✅ Created barber entry:', {
      id: barberEntry.id,
      amount: barberEntry.amount,
      description: barberEntry.description,
      reference: barberEntry.reference,
      category: barberEntry.category?.name,
    });
    
    // Create salon share entry if needed
    if (salonShare > 0) {
      const incomeCategory = await prisma.financialCategory.findFirst({
        where: { name: 'سهم آرایشگاه', type: 'INCOME' }
      }) || await prisma.financialCategory.create({
        data: {
          name: 'سهم آرایشگاه',
          type: 'INCOME',
          description: 'سهم آرایشگاه از برداشت آرایشگران',
          updatedAt: new Date()
        }
      });
      
      const salonEntry = await prisma.financialEntry.create({
        data: {
          amount: salonShare,
          type: 'INCOME',
          date: new Date(),
          description: `سهم آرایشگاه از برداشت ${withdrawal.barber.firstName} ${withdrawal.barber.lastName} (${salonShare.toLocaleString()} تومان)`,
          categoryId: incomeCategory.id,
          reference: `WITHDRAWAL-SALON-${withdrawal.id}`,
          paymentMethod: 'CASH',
          createdBy: 20,
          updatedAt: new Date(),
        },
        include: { category: true },
      });
      
      console.log('✅ Created salon entry:', {
        id: salonEntry.id,
        amount: salonEntry.amount,
        description: salonEntry.description,
        reference: salonEntry.reference,
        category: salonEntry.category?.name,
      });
    }
    
    // Check final balance
    const totalIncome = await prisma.financialEntry.aggregate({
      _sum: { amount: true },
      where: {
        type: 'INCOME',
        transactions: {
          some: {
            appointment: {
              barberId: withdrawal.barberId,
            },
          },
        },
      },
    });
    
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
              contains: `${withdrawal.barber.firstName} ${withdrawal.barber.lastName}`,
            },
          },
          {
            description: {
              contains: `پرداخت حقوق به ${withdrawal.barber.firstName} ${withdrawal.barber.lastName}`,
            },
          },
        ],
      },
    });
    
    console.log('📊 Final balance calculation:', {
      barberId: withdrawal.barberId,
      totalIncome: totalIncome._sum.amount || 0,
      totalWithdrawals: totalWithdrawals._sum.amount || 0,
      balance: (totalIncome._sum.amount || 0) - (totalWithdrawals._sum.amount || 0),
    });
    
    // Clean up - delete test withdrawal and entries
    await prisma.financialEntry.deleteMany({
      where: {
        OR: [
          { reference: `WITHDRAWAL-${withdrawal.id}` },
          { reference: `WITHDRAWAL-SALON-${withdrawal.id}` },
        ],
      },
    });
    
    await prisma.barberWithdrawalRequest.delete({
      where: { id: withdrawal.id },
    });
    
    console.log('🧹 Cleaned up test data');
    
  } catch (error) {
    console.error('❌ Error testing new withdrawal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNewWithdrawal(); 