import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('🔍 Connecting to database...');
    
    const users = await prisma.user.findMany();
    console.log('\n📊 All users in database:');
    console.log(JSON.stringify(users, null, 2));
    
    const adminUser = await prisma.user.findFirst({
      where: {
        username: 'admin'
      }
    });
    
    console.log('\n👤 Admin user details:');
    console.log(JSON.stringify(adminUser, null, 2));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase(); 