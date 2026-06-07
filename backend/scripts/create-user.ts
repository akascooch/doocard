import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'scoochexy@gmail.com';
  const plainPassword = 'Lord7knows';
  const phoneNumber = '09370504588';

  const hashedPassword = await bcrypt.hash(plainPassword, 10);
  const now = new Date();

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      phoneNumber,
      isActive: true,
      updatedAt: now,
      role: 'ADMIN',
    },
    create: {
      email,
      password: hashedPassword,
      firstName: 'ادمین',
      lastName: 'سیستم',
      phoneNumber,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      role: 'ADMIN',
    },
    select: { id: true, email: true, role: true, phoneNumber: true },
  });

  console.log('✅ Created/Updated user:', user);
}

main()
  .catch((e) => {
    console.error('❌ Error creating user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


