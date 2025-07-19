const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10);

  const user = await prisma.user.create({
    data: {
      email: 'scoochexy@gmail.com',
      password: hashedPassword,
      firstName: 'امیرعلی',
      lastName: 'حسینی',
      phoneNumber: '09123141478',
      isActive: true,
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log('✅ Admin user created:', user);
}

main()
  .catch((e) => {
    console.error('❌ Error creating admin:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });