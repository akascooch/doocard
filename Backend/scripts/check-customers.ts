import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Checking customers table...');
    
    const customers = await prisma.customer.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Total customers found: ${customers.length}`);
    console.log('Customers:');
    console.log(JSON.stringify(customers, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 