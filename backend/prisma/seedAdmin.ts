import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const adminEmail = 'scoochexy@gmail.com';
  const adminPhone = '09370504588';
  const adminName = 'scooch';
  const defaultPassword = 'admin123';
  const saltRounds = 12;

  try {
    const existing = await prisma.user.findFirst({
      where: { email: adminEmail },
      select: { id: true },
    });

    if (existing) {
      console.log(`Admin user already exists (id=${existing.id}). Skipping creation.`);
      return;
    }

    const passwordHash = await bcrypt.hash(defaultPassword, saltRounds);

    const created = await prisma.user.create({
      data: {
        email: adminEmail,
        phone: adminPhone,
        name: adminName,
        role: UserRole.ADMIN,
        password: passwordHash,
      },
      select: { id: true },
    });

    console.log(`Admin user created with id=${created.id}. A default password has been set.`);
  } catch (error) {
    console.error('Failed to seed admin user:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();


