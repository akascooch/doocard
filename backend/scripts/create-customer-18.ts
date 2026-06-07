import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createCustomer18() {
  console.log('👤 Creating Customer ID=18 (مشتری عمومی)...\n');

  try {
    // Check if customer 18 exists
    const existing = await prisma.customer.findUnique({
      where: { id: 18 },
    });

    if (existing) {
      console.log('✅ Customer 18 already exists!');
      return;
    }

    // Create user first
    const hashedPassword = await bcrypt.hash('123456', 10);
    
    const user = await prisma.user.create({
      data: {
        name: 'مشتری عمومی - داده‌های قدیمی',
        phone: '09000000018',
        email: 'general-customer-18@doocard.local',
        password: hashedPassword,
        role: 'CUSTOMER',
      },
    });

    console.log('✅ User created:', user.id);

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        id: 18, // Force ID=18
        userId: user.id,
        notes: 'مشتری عمومی برای داده‌های import شده از Excel',
      },
    });

    console.log('✅ Customer created:', customer.id);
    console.log('\n🎉 Customer 18 ready for import!');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createCustomer18();

