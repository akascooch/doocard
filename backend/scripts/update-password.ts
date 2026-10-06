import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function updateAdminPassword() {
  const newPassword = process.env.UPDATE_ADMIN_PASSWORD;
  if (!newPassword) {
    throw new Error('UPDATE_ADMIN_PASSWORD is required');
  }

  const adminUser = await prisma.user.findFirst({
    where: { username: 'admin' },
    select: { id: true },
  });

  if (!adminUser) {
    console.error('Admin user not found.');
    return;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { password: hashedPassword },
  });

  console.log(`Password updated for user id=${adminUser.id}.`);
}

updateAdminPassword()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Password update failed.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
