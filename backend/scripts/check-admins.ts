import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdmins() {
  try {
    console.log('🔍 Checking admin users...');
    
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
    
    console.log('📊 Admin users:', admins);
    
    // Also check all users
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
      take: 10,
    });
    
    console.log('📊 All users (first 10):', allUsers);
    
  } catch (error) {
    console.error('❌ Error checking admins:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmins(); 