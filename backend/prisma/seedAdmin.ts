import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Refusing to seed an admin user.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const adminEmail = requiredEnv('SEED_ADMIN_EMAIL');
  const adminPhone = requiredEnv('SEED_ADMIN_PHONE');
  const adminName = requiredEnv('SEED_ADMIN_NAME');
  const adminPassword = requiredEnv('SEED_ADMIN_PASSWORD');
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

    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

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

    console.log(`Admin user created with id=${created.id}.`);
  } catch (error) {
    console.error('Failed to seed admin user:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
