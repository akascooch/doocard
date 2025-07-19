// @ts-ignore
// This script is intended to run in a Node.js environment
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Sync customers
  const usersCustomers = await prisma.user.findMany({ where: { role: 'CUSTOMER' } });
  for (const user of usersCustomers) {
    const exists = await prisma.customer.findUnique({ where: { email: user.email } });
    if (!exists) {
      await prisma.customer.create({
        data: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          isActive: user.isActive,
          updatedAt: user.updatedAt,
        },
      });
      console.log(`Customer created for user: ${user.email}`);
    }
  }

  // Sync barbers
  const usersBarbers = await prisma.user.findMany({ where: { role: 'BARBER' } });
  for (const user of usersBarbers) {
    const exists = await prisma.barber.findUnique({ where: { email: user.email } });
    if (!exists) {
      await prisma.barber.create({
        data: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          isActive: user.isActive,
          updatedAt: user.updatedAt,
        },
      });
      console.log(`Barber created for user: ${user.email}`);
    }
  }

  console.log('Sync complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 