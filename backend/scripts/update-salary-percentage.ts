import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateSalaryPercentage() {
  try {
    console.log('🔍 Updating all barbers salary percentage to 60%...');
    
    const result = await prisma.barber.updateMany({
      where: {
        // Update all barbers
      },
      data: {
        salaryPercentage: 60
      }
    });
    
    console.log(`✅ Updated ${result.count} barbers to 60% salary percentage`);
    
    // Show current barbers
    const barbers = await prisma.barber.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        salaryPercentage: true
      }
    });
    
    console.log('📊 Current barbers:');
    barbers.forEach(barber => {
      console.log(`- ${barber.firstName} ${barber.lastName} (${barber.email}): ${barber.salaryPercentage}%`);
    });
    
  } catch (error) {
    console.error('❌ Error updating salary percentage:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSalaryPercentage(); 