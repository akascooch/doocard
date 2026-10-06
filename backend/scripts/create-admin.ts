import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  const password = process.env.CREATE_ADMIN_PASSWORD;
  if (!password) {
    throw new Error('CREATE_ADMIN_PASSWORD is required');
  }

  console.log('Creating admin user...');

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  });

  if (existingAdmin) {
    console.log('An admin user already exists.');
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      firstName: 'مدیر',
      lastName: 'سیستم',
      phoneNumber: '09120000000',
      role: 'ADMIN',
      updatedAt: new Date(),
    },
  });

  console.log(`Admin user created. id=${admin.id}`);
}

createAdmin()
  .catch((error) => {
    console.error('Failed to create admin user.');
    console.error(error instanceof Error ? error.message : 'unknown error');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
