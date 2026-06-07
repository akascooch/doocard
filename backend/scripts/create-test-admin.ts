import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestAdmin() {
  try {
    console.log('🔍 Creating test admin...');
    
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const admin = await prisma.user.upsert({
      where: { email: 'testadmin@example.com' },
      update: {
        password: hashedPassword,
        firstName: 'تست',
        lastName: 'ادمین',
        role: 'ADMIN',
        isActive: true,
      },
      create: {
        email: 'testadmin@example.com',
        password: hashedPassword,
        firstName: 'تست',
        lastName: 'ادمین',
        phoneNumber: '09123456789',
        role: 'ADMIN',
        isActive: true,
        updatedAt: new Date(),
      },
    });
    
    console.log('✅ Test admin created/updated:', {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      role: admin.role,
      password: 'admin123', // plain text for reference
    });
    
  } catch (error) {
    console.error('❌ Error creating test admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestAdmin(); 