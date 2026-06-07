const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findBarber() {
  try {
    console.log('👨‍💼 Finding existing barber...\n');

    const barbers = await prisma.barber.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true
      },
      take: 5
    });

    console.log(`Found ${barbers.length} barbers:`);
    barbers.forEach((barber, i) => {
      console.log(`${i + 1}. ID: ${barber.id}, Name: ${barber.firstName} ${barber.lastName}, Email: ${barber.email || 'بدون ایمیل'}`);
    });

    if (barbers.length > 0) {
      console.log(`\n✅ Using barber ID: ${barbers[0].id}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

findBarber();
