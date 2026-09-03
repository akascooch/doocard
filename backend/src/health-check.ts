import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function healthCheck() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check if we can read from a table
    const userCount = await prisma.user.count();
    
    console.log('Health check passed');
    console.log(`Database connected, users count: ${userCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

healthCheck();
