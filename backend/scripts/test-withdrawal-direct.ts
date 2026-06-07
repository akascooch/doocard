import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testWithdrawalDirect() {
  try {
    console.log('🔍 Testing withdrawal approval directly...');
    
    // Get pending withdrawal requests
    const pendingWithdrawals = await prisma.barberWithdrawalRequest.findMany({
      where: { status: 'PENDING' },
      include: { barber: true },
    });
    
    console.log('📊 Pending withdrawals:', pendingWithdrawals.map(w => ({
      id: w.id,
      barberName: `${w.barber.firstName} ${w.barber.lastName}`,
      amount: w.amount,
      status: w.status,
      createdAt: w.createdAt,
    })));
    
    if (pendingWithdrawals.length === 0) {
      console.log('❌ No pending withdrawal requests found');
      return;
    }
    
    const withdrawal = pendingWithdrawals[0];
    console.log('📊 Selected withdrawal:', withdrawal);
    
    // Get bank accounts
    const bankAccounts = await prisma.bankAccount.findMany();
    console.log('📊 Bank accounts:', bankAccounts);
    
    if (bankAccounts.length === 0) {
      console.log('❌ No bank accounts found');
      return;
    }
    
    const bankAccount = bankAccounts[0];
    
    // Simulate approval process
    console.log('🔍 Simulating approval process...');
    
    // 1. Update withdrawal status
    const updatedWithdrawal = await prisma.barberWithdrawalRequest.update({
      where: { id: withdrawal.id },
      data: { 
        status: 'APPROVED', 
        approvedBy: 26, // test admin ID
        updatedAt: new Date() 
      },
      include: { barber: true },
    });
    
    console.log('✅ Updated withdrawal:', updatedWithdrawal);
    
    // 2. Calculate shares
    const salonPercentage = 40;
    const salonShare = Math.round(withdrawal.amount * salonPercentage / 100);
    const barberShare = withdrawal.amount - salonShare;
    
    console.log('📊 Calculated shares:', {
      totalAmount: withdrawal.amount,
      salonPercentage,
      salonShare,
      barberShare,
    });
    
    // 3. Get or create salary category
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
    
    // 4. Create barber share entry
    const barberEntry = await prisma.financialEntry.create({
      data: {
        amount: -barberShare,
        type: 'EXPENSE',
        date: new Date(),
        description: `پرداخت حقوق به ${withdrawal.barber.firstName} ${withdrawal.barber.lastName} (سهم آرایشگر: ${barberShare.toLocaleString()} تومان)`,
        categoryId: salaryCategory.id,
        reference: `WITHDRAWAL-${withdrawal.id}`,
        paymentMethod: 'CASH',
        createdBy: 26, // test admin ID
        updatedAt: new Date(),
        bankAccountId: bankAccount.id,
      },
      include: { category: true, bankAccount: true },
    });
    
    console.log('✅ Created barber entry:', {
      id: barberEntry.id,
      amount: barberEntry.amount,
      description: barberEntry.description,
      reference: barberEntry.reference,
      category: barberEntry.category?.name,
      bankAccount: barberEntry.bankAccount?.name,
    });
    
    // 5. Create salon share entry if needed
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
          createdBy: 26, // test admin ID
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
    
    // 6. Check final balance
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
    
    // 7. Check recent entries
    const recentEntries = await prisma.financialEntry.findMany({
      where: {
        OR: [
          { reference: `WITHDRAWAL-${withdrawal.id}` },
          { reference: `WITHDRAWAL-SALON-${withdrawal.id}` },
        ],
      },
      include: { category: true, bankAccount: true },
      orderBy: { createdAt: 'desc' },
    });
    
    console.log('📊 Recent entries for this withdrawal:', recentEntries.map(e => ({
      id: e.id,
      amount: e.amount,
      type: e.type,
      description: e.description,
      reference: e.reference,
      category: e.category?.name,
      bankAccount: e.bankAccount?.name,
      createdAt: e.createdAt,
    })));
    
  } catch (error) {
    console.error('❌ Error testing withdrawal directly:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testWithdrawalDirect(); 