/**
 * One-time admin password reset.
 * Usage (from backend/):
 *   $env:ADMIN_IDENTIFIER="09370504588"; $env:ADMIN_NEW_PASSWORD="your-password"; npx ts-node scripts/reset-admin-password.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function resetAdminPassword() {
  const phone = process.env.ADMIN_IDENTIFIER?.trim();
  const newPassword = process.env.ADMIN_NEW_PASSWORD;

  if (!phone || !newPassword) {
    console.error(
      'Set ADMIN_IDENTIFIER and ADMIN_NEW_PASSWORD environment variables.',
    );
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({ where: { phone } });

    if (!user) {
      console.error(`User not found for phone: ${phone}`);
      process.exit(1);
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    const verified = await bcrypt.compare(newPassword, updated!.password);

    if (!verified) {
      console.error('Password verification failed after update.');
      process.exit(1);
    }

    console.log('Admin password reset successful.');
    console.log(`User id: ${user.id}, phone: ${user.phone}, role: ${user.role}`);
  } catch (error) {
    console.error('Error resetting password:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetAdminPassword();
